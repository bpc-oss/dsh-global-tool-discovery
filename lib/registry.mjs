/**
 * Side-effect-free source adapter registry.
 */

export const sourceAdapters = new Map()

export function registerSourceAdapter(name, adapter) {
  if (!name || !adapter || typeof adapter.search !== 'function') {
    throw new Error('Invalid source adapter')
  }
  sourceAdapters.set(name, adapter)
}
