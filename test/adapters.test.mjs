import test from 'node:test'
import assert from 'node:assert/strict'
import { rssAdapter } from '../adapters/rss.mjs'
import { hackernewsAdapter } from '../adapters/hackernews.mjs'

test('rssAdapter normalize returns UnifiedResult', () => {
  const raw = { title: 'Test Article', link: 'http://example.com', description: 'A test article', pubDate: '2024-01-01' }
  const result = rssAdapter.normalize(raw)
  assert.equal(result.title, 'Test Article')
  assert.equal(result.url, 'http://example.com')
  assert.equal(result.snippet, 'A test article')
  assert.equal(result.publishedAt, '2024-01-01')
  assert.match(result.dedupKey, /^sha256:/)
})

test('rssAdapter normalize handles missing fields', () => {
  const result = rssAdapter.normalize({})
  assert.equal(result.title, '')
  assert.equal(result.url, '')
  assert.equal(result.snippet, '')
  assert.equal(result.publishedAt, '')
})

test('hackernewsAdapter normalize returns UnifiedResult', () => {
  const raw = { title: 'HN Post', link: 'http://hn.example.com', description: 'A discussion', pubDate: '2024-06-15T10:00:00Z' }
  const result = hackernewsAdapter.normalize(raw)
  assert.equal(result.title, 'HN Post')
  assert.equal(result.url, 'http://hn.example.com')
  assert.equal(result.snippet, 'A discussion')
  assert.equal(result.publishedAt, '2024-06-15T10:00:00Z')
  assert.match(result.dedupKey, /^sha256:/)
})

test('hackernewsAdapter normalize handles missing fields', () => {
  const result = hackernewsAdapter.normalize({})
  assert.equal(result.title, '')
  assert.equal(result.url, '')
  assert.equal(result.snippet, '')
  assert.equal(result.publishedAt, '')
})