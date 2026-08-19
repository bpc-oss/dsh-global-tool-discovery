import test from 'node:test'
import assert from 'node:assert/strict'
import { parseToolNames, unlockedFor } from '../lib/session-unlock.mjs'

test('parseToolNames returns only non-empty strings', () => {
  assert.deepEqual(parseToolNames({ toolNames: ['a', '', 'b', 3] }), ['a', 'b'])
})

test('parseToolNames handles invalid input', () => {
  assert.deepEqual(parseToolNames(null), [])
  assert.deepEqual(parseToolNames('x'), [])
  assert.deepEqual(parseToolNames({}), [])
})

test('unlockedFor reads dev_tool_search tool/call events', () => {
  const session = {
    events: [
      { type: 'user/message', data: { name: 'dev_tool_search', arguments: '{"toolNames":["mcp__x__a"]}' } },
      { type: 'tool/call', data: { name: 'other', arguments: '{"toolNames":["ignored"]}' } },
      { type: 'tool/call', data: { name: 'dev_tool_search', arguments: '{"toolNames":["mcp__x__a","mcp__x__b"]}' } },
      { type: 'tool/call', data: { name: 'dev_tool_search', arguments: 'not-json' } },
    ],
  }
  const unlocked = unlockedFor(session)
  assert.deepEqual([...unlocked].sort(), ['mcp__x__a', 'mcp__x__b'])
})

test('unlockedFor handles empty/missing session', () => {
  assert.equal(unlockedFor(undefined).size, 0)
  assert.equal(unlockedFor({}).size, 0)
  assert.equal(unlockedFor({ events: [] }).size, 0)
})
