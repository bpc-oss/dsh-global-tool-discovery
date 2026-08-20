/**
 * RSS source adapter for research_orchestrator.
 * Uses Google News RSS search; returns UnifiedResult[].
 */

import { createHash } from 'node:crypto'

export const rssAdapter = {
  name: 'rss',
  async search(query, limit = 10) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research-orchestrator)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const text = await res.text()
    return parseRssXml(text).slice(0, limit)
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

function parseRssXml(xml) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  const titleRe = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/
  const linkRe = /<link>([\s\S]*?)<\/link>/
  const descRe = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/
  const dateRe = /<pubDate>([\s\S]*?)<\/pubDate>/
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1]
    const title = decodeEntities(chunk.match(titleRe)?.[1] || '').trim()
    const link = decodeEntities(chunk.match(linkRe)?.[1] || '').trim()
    const description = decodeEntities(chunk.match(descRe)?.[1] || '').trim().slice(0, 300)
    const pubDate = chunk.match(dateRe)?.[1] || ''
    if (title || link) items.push({ title, link, description, pubDate })
  }
  return items
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
