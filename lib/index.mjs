/**
 * dsh-global-tool-discovery
 *
 * Global, session-scoped tool discovery + unlock for DSH.
 *
 * - Registers a single global `dev_tool_search` tool.
 * - Searches the full assembled tool catalog for the current agent.
 * - Records `toolNames` unlocks into the current session's tool/call events.
 * - Does NOT filter the assembled catalog, so it stays compatible with
 *   preset-level bootstrap filters (anchored-standard, verifier-standard, etc.).
 *
 * Unlock is session-scoped: a new conversation has no unlock history.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-global-tool-discovery'

/** The tools registry must exist before this tool can register. */
export const inject = ['tools']

const DEFAULT_RESIDENT_TOOLS = ['pwsh', 'str_replace_editor', 'dev_tool_search', 'skill_search', 'skill_load']

const GENERIC_INDEX = [
  'web_search — internet search and web retrieval',
  'subagent / subagent_fork — delegate work to sub-agents',
  'workflow — run multi-agent workflow scripts',
  'ralph — fresh-agent iterative loop',
  'create_goal / get_goal / update_goal — long-running goals',
  'read_image — read image files',
  'job_list / job_output / job_kill — background jobs',
  'interrupt_agent / send_message / list_agents — multi-agent control',
  'todo_write — task tracking',
  'ask_user_question — ask the user',
  'dev_inject_plugin / dev_uninject_plugin / dev_reload_package / dev_plugin_status — runtime plugin injection',
  'Chrome automation MCP tools — search "chrome" for exact tool names',
]

/** Minimal JSON schema compiler for tool parameters. */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    if (meta.items) prop.items = meta.items
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

/**
 * Split a query into match tokens.
 *
 * ASCII queries are split on non-alphanumeric separators.
 * Queries containing CJK are split on whitespace only, because CJK text does
 * not use spaces between words and splitting on punctuation destroys matches.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeQuery(query) {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const hasCjk = parts.some((part) => /[\u3400-\u9fff]/.test(part))
  if (hasCjk) return parts.map((part) => part.toLowerCase())
  return trimmed.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
}

/**
 * Whether a tool schema matches a query.
 *
 * @param {{ name?: string, description?: string }} schema
 * @param {string} query
 * @returns {boolean}
 */
export function matchesQuery(schema, query) {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return false
  const haystack = `${schema.name ?? ''} ${schema.description ?? ''}`.toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

function buildDescription(config, residentTools) {
  const shellName = process.platform === 'win32' ? 'pwsh' : 'bash'
  const lines = [
    'Discover and unlock tools that are NOT currently available.',
    '',
    `Default resident tools where the preset provides them: ${[...new Set([shellName, ...residentTools])].join(', ')}. Everything else can be discovered here.`,
    '',
    config.sessionScoped === false
      ? 'Unlocks may persist according to the hosting DSH version.'
      : 'Unlocks are SESSION-SCOPED: they apply only to the current conversation and are never inherited by new conversations.',
    '',
    'If the current task needs any of the following, call dev_tool_search FIRST:',
    ...GENERIC_INDEX.map((line) => `- ${line}`),
    '',
    'Usage: pass `query` to search the catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them. Unlocked tools appear from the next request on and stay unlocked for this session.',
  ]
  return lines.join('\n')
}

/** Register the global `dev_tool_search` tool. */
export function apply(ctx, config = {}) {
  const maxResults = Number.isInteger(config.maxResults) && config.maxResults > 0 ? config.maxResults : 25
  const residentTools = Array.isArray(config.residentTools) && config.residentTools.length > 0
    ? config.residentTools.filter((name) => typeof name === 'string' && name.length > 0)
    : DEFAULT_RESIDENT_TOOLS
  const sessionScoped = config.sessionScoped !== false

  ctx.effect(() => {
    const dispose = ctx.tools.register({
      name: 'dev_tool_search',
      description: buildDescription({ sessionScoped }, residentTools),
      parameters: toJsonSchema({
        query: { type: 'string', required: false, description: 'search keywords (e.g. "chrome", "inject", "subagent")' },
        toolNames: {
          type: 'array',
          required: false,
          description: 'exact tool names to unlock for this session',
          items: { type: 'string' },
        },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        const query = typeof args.query === 'string' ? args.query : ''
        const unlock = Array.isArray(args.toolNames) ? args.toolNames.filter((name) => typeof name === 'string' && name.length > 0) : []

        const lines = []
        if (unlock.length > 0) {
          lines.push(`Unlocked for this session (next request): ${unlock.join(', ')}`)
        }
        if (query.length === 0 && unlock.length === 0) {
          lines.push('Provide `query` to search the catalog, or `toolNames` to unlock tools.')
          return { text: lines.join('\n') }
        }
        if (query.length === 0) {
          return { text: lines.join('\n') || 'Nothing to do.' }
        }

        try {
          // The executing agent IS the viewing scope: this includes globally
          // registered profile/MCP tools and super-injector injected tools.
          const schemas = ctx.tools.schemas(exec?.agent)
          const all = schemas.filter((schema) => matchesQuery(schema, query))
          const matches = all.slice(0, maxResults)
          if (all.length === 0) {
            lines.push(`No tools match "${query}".`)
          } else {
            lines.push(`Matching tools (${matches.length}${all.length > maxResults ? ` of ${all.length}` : ''}):`)
            for (const schema of matches) {
              const desc = (schema.description || '').split('\n')[0].slice(0, 90)
              lines.push(`- ${schema.name}: ${desc}`)
            }
            if (all.length > maxResults) {
              lines.push(`(truncated at ${maxResults} — add tokens to narrow the query, e.g. "chrome" or "inject")`)
            }
            lines.push('Unlock with dev_tool_search({"toolNames": ["<exact name>"]}).')
          }
        } catch (error) {
          lines.push(`catalog search unavailable: ${String((error && error.message) || error)}`)
        }
        return { text: lines.join('\n') }
      },
    })
    return dispose
  })

  // Non-breaking proactive discovery hint: augment the descriptions of the
  // first-round resident tools (pwsh/bash, str_replace_editor) so the model
  // sees a dev_tool_search reminder even in presets whose bootstrap keeps a
  // minimal first-request tool list (e.g. anchored-standard). This does not
  // change the tool list or any preset's catalog filter.
  const HINT = 'Tip: If a needed capability is not listed, call dev_tool_search first to search and unlock it. For installing or injecting a new plugin, search inject to unlock dev_inject_plugin.'
  const RESIDENT_HINT_TOOLS = new Set(['pwsh', 'bash', 'str_replace_editor'])
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    try {
      if (!assembled || !Array.isArray(assembled.tools)) return assembled
      return {
        ...assembled,
        tools: assembled.tools.map((tool) => {
          if (!tool || typeof tool !== 'object') return tool
          if (!RESIDENT_HINT_TOOLS.has(tool.name)) return tool
          if (typeof tool.description === 'string' && tool.description.includes('dev_tool_search')) return tool
          return {
            ...tool,
            description: `${tool.description || ''}\n\n${HINT}`.trim(),
          }
        }),
      }
    } catch (error) {
      try {
        ctx.logger?.warn?.(`[session-tool-unlock] hint augmentation failed: ${String((error && error.message) || error)}`)
      } catch {
        // ignore logger errors
      }
      return assembled
    }
  })
}


