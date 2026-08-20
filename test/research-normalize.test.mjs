import test from 'node:test'
import assert from 'node:assert/strict'
import { dedupKey, isRetryableError, normalizePapers, normalizeExaItems, normalizeSearxngItems, normalizeCodeItems } from '../lib/research-orchestrator.mjs'

test('dedupKey returns sha256: prefixed hash', () => {
  const hash = dedupKey('test title', 'http://example.com')
  assert.match(hash, /^sha256:[a-f0-9]{64}$/)
  const hash2 = dedupKey('test title', 'http://example.com')
  assert.equal(hash, hash2) // deterministic
})

test('dedupKey different inputs differ', () => {
  const a = dedupKey('title1', 'url1')
  const b = dedupKey('title2', 'url2')
  assert.notEqual(a, b)
})

test('isRetryableError returns true for timeout', () => {
  assert.equal(isRetryableError('timeout'), true)
  assert.equal(isRetryableError('ETIMEDOUT'), true)
  assert.equal(isRetryableError('ECONNRESET'), true)
  assert.equal(isRetryableError('ECONNREFUSED'), true)
})

test('isRetryableError returns false for other codes', () => {
  assert.equal(isRetryableError('EACCES'), false)
  assert.equal(isRetryableError('ENOENT'), false)
  assert.equal(isRetryableError(429), false)
  assert.equal(isRetryableError(401), false)
  assert.equal(isRetryableError(''), false)
})

test('normalizePapers handles empty input', () => {
  assert.deepEqual(normalizePapers([]), [])
  assert.deepEqual(normalizePapers(null), [])
  assert.deepEqual(normalizePapers(undefined), [])
})

test('normalizePapers converts items', () => {
  const items = [{ title: 'Test Paper', url: 'http://doi.org/10.1234', authors: ['A', 'B'], year: 2024 }]
  const result = normalizePapers(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Test Paper')
  assert.equal(result[0].dedupKey.startsWith('sha256:'), true)
  assert.match(result[0].snippet, /A, B/)
})

test('normalizeExaItems handles empty', () => {
  assert.deepEqual(normalizeExaItems({}), [])
  assert.deepEqual(normalizeExaItems({ result: { content: [{ type: 'text', text: 'Title: Test\nURL: http://x.com' }] } }).length, 1)
})

test('normalizeCodeItems handles empty', () => {
  assert.deepEqual(normalizeCodeItems([]), [])
  assert.deepEqual(normalizeCodeItems([{ name: 'repo', url: 'http://github.com/r', description: 'desc' }]).length, 1)
})