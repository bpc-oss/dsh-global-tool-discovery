import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenizeQuery, matchesQuery } from '../lib/index.mjs'

test('tokenizeQuery splits ASCII query', () => {
  assert.deepEqual(tokenizeQuery('chrome tabs'), ['chrome', 'tabs'])
})

test('tokenizeQuery keeps CJK query intact per whitespace part', () => {
  assert.deepEqual(tokenizeQuery('浏览器 插件'), ['浏览器', '插件'])
})

test('matchesQuery matches CJK substring in description', () => {
  assert.equal(matchesQuery({ name: 'mcp__x__foo', description: '控制浏览器插件' }, '浏览器'), true)
})

test('matchesQuery does not match unrelated CJK', () => {
  assert.equal(matchesQuery({ name: 'mcp__x__foo', description: '控制浏览器插件' }, '邮件'), false)
})

test('matchesQuery matches English words', () => {
  assert.equal(matchesQuery({ name: 'dev_inject_plugin', description: 'runtime plugin injection' }, 'inject plugin'), true)
})
