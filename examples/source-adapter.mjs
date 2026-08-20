/**
 * Example custom source adapter.
 *
 * Implement `search(query, limit, timeout)` and register it with:
 *
 *   import { registerSourceAdapter } from 'dsh-global-tool-discovery'
 *   registerSourceAdapter('my-source', myAdapter)
 */

import { createHash } from 'node:crypto'

export const myAdapter = {
  name: 'my-source',
  async search(query, limit = 10) {
    const url = `https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results || []).map((item) => ({
      title: item.title || '',
      link: item.url || '',
      description: item.snippet || '',
      pubDate: item.publishedAt || '',
    }))
  },
  normalize(raw) {
    return {
      title: raw.title || '',
      url: raw.link || '',
      snippet: raw.description || '',
      publishedAt: raw.pubDate || '',
      dedupKey: `sha256:${createHash('sha256').update(`${raw.title || ''}|${raw.link || ''}`).digest('hex')}`,
    }
  },
}