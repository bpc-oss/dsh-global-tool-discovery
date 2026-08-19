/**
 * dsh-global-skill-tools — global, session-scoped skill discovery and loading.
 *
 * Provides `skill_search` / `skill_load` to every preset/conversation that is
 * not explicitly disabled, matching the global `dev_tool_search` pattern.
 *
 * Design notes:
 * - Uses `exec.agent` as the viewing scope so preset-private skills stay
 *   scoped to that agent and are never leaked across presets.
 * - Filters `skill.invocation.modelInvocable` so disabled-model-invocation
 *   skills are not advertised or loadable by the model.
 * - Skill bodies are size-bounded before injection.
 * - Per-preset opt-out: worker/minimal presets can disable these tools.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-global-skill-tools'

/** The agent, tools, and skills services must exist before these tools can register. */
export const inject = ['agents', 'tools', 'skills']

const DEFAULT_DISABLED_PRESETS = ['employee-ops']
const DEFAULT_MAX_RESULTS = 20
const DEFAULT_MAX_BODY_CHARS = 120000

/** Minimal JSON schema compiler for tool parameters (zero dependencies). */
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

/** Normalize a query into lowercase tokens; CJK queries use whitespace parts. */
function tokenizeQuery(query) {
  const trimmed = (query || '').trim()
  if (trimmed.length === 0) return []
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const hasCjk = parts.some((part) => /[\u3400-\u9fff]/.test(part))
  if (hasCjk) return parts.map((part) => part.toLowerCase())
  return trimmed.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean)
}

/** Whether a skill summary is allowed to be model-invoked. */
function isModelAllowed(skill) {
  return skill?.invocation?.modelInvocable !== false
}

/** Extract the model-facing body of a loaded skill definition. */
function extractSkillBody(skill) {
  const content = skill?.content ?? skill?.instructions ?? skill?.body
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join('\n')
  }
  return ''
}

function presetOf(agent) {
  return agent?.session?.header?.agentPreset || agent?.preset
}

/** Register the two global on-demand skill tools. */
export function apply(ctx, config = {}) {
  const disabledPresets = new Set(
    Array.isArray(config.disabledPresets) && config.disabledPresets.length > 0
      ? config.disabledPresets
      : DEFAULT_DISABLED_PRESETS,
  )
  const maxResults = Number.isInteger(config.maxResults) && config.maxResults > 0 ? config.maxResults : DEFAULT_MAX_RESULTS
  const maxBodyChars = Number.isInteger(config.maxBodyChars) && config.maxBodyChars > 0 ? config.maxBodyChars : DEFAULT_MAX_BODY_CHARS

  const isDisabledFor = (agent) => disabledPresets.has(presetOf(agent))

  ctx.effect(() => {
    const disposeSearch = ctx.tools.register({
      name: 'skill_search',
      description: 'Search the available skills by keyword and return matching skill names with short descriptions. This session keeps NO skill catalog in the prompt — if a task looks like it matches a skill (document conversion, image processing, game reviews, markdown, PDF, spreadsheets, …), call skill_search FIRST to find it, then skill_load to activate it. Do NOT assume skill names from memory.',
      parameters: toJsonSchema({
        query: { type: 'string', required: true, description: 'search keywords (e.g. "pdf", "obsidian", "game review")' },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        if (isDisabledFor(exec?.agent)) {
          return { text: 'skill_search is disabled for this preset.' }
        }
        const wanted = tokenizeQuery(args.query)
        try {
          const all = await ctx.skills.list({
            scope: exec?.agent ?? ctx,
            cwd: exec?.agent?.session?.header?.cwd,
            signal: exec?.signal,
          })
          const matches = all.filter((skill) => {
            if (!isModelAllowed(skill)) return false
            if (wanted.length === 0) return true
            const haystack = tokenizeQuery(`${skill.name} ${skill.description ?? ''} ${skill.whenToUse ?? ''}`).join(' ')
            return wanted.every((token) => haystack.includes(token))
          })
          const head = matches.slice(0, maxResults)
          const lines = head.map((skill) => {
            const desc = (skill.description || '').split('\n')[0]
            return `- ${skill.name}: ${desc}`
          })
          if (lines.length === 0) {
            return { text: `No skills match "${args.query}". Use skill_search with other keywords.` }
          }
          const extra = matches.length > maxResults ? `\n…(${matches.length - maxResults} more)` : ''
          return { text: `Matching skills (${matches.length}):\n${lines.join('\n')}${extra}\n\nLoad one with skill_load (exact name).` }
        } catch (error) {
          return { text: `skill_search unavailable: ${String((error && error.message) || error)}` }
        }
      },
    })

    const disposeLoad = ctx.tools.register({
      name: 'skill_load',
      description: 'Load the full instructions of ONE skill by its exact name (from skill_search results) and inject them for the next request. Call this before acting on a task that matches the skill.',
      parameters: toJsonSchema({
        name: { type: 'string', required: true, description: 'exact skill name (kebab-case, from skill_search)' },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        if (isDisabledFor(exec?.agent)) {
          return { text: 'skill_load is disabled for this preset.' }
        }
        try {
          const agent = exec?.agent
          if (agent === undefined) return { text: 'skill_load requires an agent context.' }
          const skill = await ctx.skills.get(args.name, {
            scope: agent,
            cwd: agent.session.header.cwd,
            signal: exec?.signal,
          })
          if (skill === undefined) {
            return { text: `No skill named "${args.name}". Run skill_search to list available skills.` }
          }
          if (!isModelAllowed(skill)) {
            return { text: `Skill "${args.name}" is not available for model invocation.` }
          }
          let body = extractSkillBody(skill)
          if (body.length === 0) {
            return { text: `Skill "${args.name}" has no loadable body.` }
          }
          let truncated = false
          if (body.length > maxBodyChars) {
            truncated = true
            body = `${body.slice(0, maxBodyChars)}\n\n[skill body truncated at ${maxBodyChars} characters]`
          }
          agent.inject({
            id: `skill-load-${args.name}-${Date.now()}`,
            role: 'user',
            content: [{ type: 'text', text: body }],
            source: { kind: 'skill-invocation', name: args.name, form: 'instructions' },
          })
          return { text: `Skill "${args.name}" loaded${truncated ? ` (body truncated at ${maxBodyChars} characters)` : ""}; its instructions will be injected for the next request.` }
        } catch (error) {
          return { text: `skill_load failed: ${String((error && error.message) || error)}` }
        }
      },
    })

    return () => {
      disposeSearch()
      disposeLoad()
    }
  })

  // Per-preset opt-out: for disabled presets, remove the global skill tools
  // from the model-visible catalog. This is a narrow, preset-specific filter
  // and does not alter any preset's own catalog policy for enabled presets.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    try {
      if (!assembled || !Array.isArray(assembled.tools)) return assembled
      const agent = context?.agent
      if (!isDisabledFor(agent)) return assembled
      return {
        ...assembled,
        tools: assembled.tools.filter((tool) => tool?.name !== 'skill_search' && tool?.name !== 'skill_load'),
      }
    } catch (error) {
      try {
        ctx.logger?.warn?.(`[global-skill-tools] filter failed: ${String((error && error.message) || error)}`)
      } catch {
        // ignore logger errors
      }
      return assembled
    }
  })
}


