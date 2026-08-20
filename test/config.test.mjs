import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

function createFakeCtx(schemas) {
  let registered = []
  const ctx = {
    tools: {
      register(def) {
        registered.push(def)
        return () => {}
      },
      schemas() {
        return schemas
      },
    },
    effect(fn) {
      fn()
    },
    on() {},
  }
  return { ctx, getTool: (name) => registered.find((t) => t.name === name) }
}

test('execute respects maxResults', async () => {
  const schemas = Array.from({ length: 30 }, (_, i) => ({
    name: `tool_${i}`,
    description: 'same keyword for search',
  }))
  const { ctx, getTool } = createFakeCtx(schemas)
  apply(ctx, { maxResults: 5 })

  const result = await getTool('dev_tool_search').execute({ query: 'keyword' }, { agent: {} })
  assert.match(result.text, /Matching tools \(5 of 30\)/)
  assert.match(result.text, /truncated at 5/)
})

test('execute returns unlock confirmation even without query', async () => {
  const { ctx, getTool } = createFakeCtx([])
  apply(ctx, {})
  const result = await getTool('dev_tool_search').execute({ toolNames: ['mcp__x__a'] }, { agent: {} })
  assert.match(result.text, /Unlocked for this session/)
})
