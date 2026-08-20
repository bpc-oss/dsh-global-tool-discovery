/**
 * Hacker News source adapter for research_orchestrator.
 * Uses Algolia API; no API key required.
 */

import { createHash } from 'node:crypto'

export const hackernewsAdapter = {
  name: 'hackernews',
  async search(query, limit = 10) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research-orchestrator)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.hits || []).map((hit) => ({
      title: hit.title || '',
      link: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      description: hit.story_text || hit.comment_text || '',
      pubDate: hit.created_at || '',
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