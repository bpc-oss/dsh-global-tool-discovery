/**
 * session-unlock — reusable session-scoped unlock helpers.
 *
 * `dev_tool_search` only records unlock requests into the current session's
 * durable tool/call events. Whether those unlocked tools actually become
 * visible depends on the preset's catalog filter (e.g. anchored-standard's
 * tool-bootstrap). This module provides the shared helper so preset authors
 * do not need to reimplement the same event parsing.
 */

/**
 * Extract exact tool names from a `dev_tool_search` arguments object.
 *
 * @param {unknown} args
 * @returns {string[]}
 */
export function parseToolNames(args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return []
  const names = args.toolNames
  if (!Array.isArray(names)) return []
  return names.filter((name) => typeof name === 'string' && name.length > 0)
}

/**
 * Collect every tool name this session has explicitly unlocked through
 * `dev_tool_search`.
 *
 * @param {{ events?: unknown[] } | undefined} session
 * @returns {Set<string>}
 */
export function unlockedFor(session) {
  const unlocked = new Set()
  if (session === undefined || !Array.isArray(session.events)) return unlocked
  for (const event of session.events) {
    if (event === null || typeof event !== 'object') continue
    if (event.type !== 'tool/call') continue
    if (event.data?.name !== 'dev_tool_search') continue
    let args
    try {
      args = JSON.parse(event.data.arguments)
    } catch {
      continue
    }
    for (const name of parseToolNames(args)) unlocked.add(name)
  }
  return unlocked
}
