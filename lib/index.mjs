/**
 * dsh-global-tool-discovery — aggregate bundle entry.
 *
 * Core is static. Research and knowledge are optional and dynamically loaded
 * so a sub-module failure does not prevent core startup.
 */

export const name = 'dsh-global-tool-discovery'
export const inject = ['tools']

import { apply as applyCore, tokenizeQuery, matchesQuery } from './core.mjs'
import { sourceAdapters, registerSourceAdapter } from './registry.mjs'

export { tokenizeQuery, matchesQuery, sourceAdapters, registerSourceAdapter }

export async function apply(ctx, config = {}) {
  // Core is always mounted.
  applyCore(ctx, config)

  if (config.enableResearch !== false) {
    try {
      const { apply: applyResearch } = await import('./research.mjs')
      await applyResearch(ctx, config)
    } catch (e) {
      ctx.logger?.warn?.(`[bundle] research disabled due to load error: ${e?.message || e}`)
    }
  }

  if (config.enableKnowledge !== false) {
    try {
      const { apply: applyKnowledge } = await import('./knowledge.mjs')
      applyKnowledge(ctx, config)
    } catch (e) {
      ctx.logger?.warn?.(`[bundle] knowledge disabled due to load error: ${e?.message || e}`)
    }
  }
}
