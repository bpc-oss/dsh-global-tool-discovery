import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

function createFakeCtx(schemas) {
  let registered = null
  const ctx = {
    tools: {
      register(def) {
        registered = def
        return () => {}
      },
      schemas() {
        return schemas
      },
    },
    effect(fn) {
      fn()
    },
  }
  return { ctx, getRegistered: () => registered }
}

test('execute respects maxResults', async () => {
  const schemas = Array.from({ length: 30 }, (_, i) => ({
    name: `tool_${i}`,
    description: 'same keyword for search',
  }))
  const { ctx, getRegistered } = createFakeCtx(schemas)
  apply(ctx, { maxResults: 5 })

  const result = await getRegistered().execute({ query: 'keyword' }, { agent: {} })
  assert.match(result.text, /Matching tools \(5 of 30\)/)
  assert.match(result.text, /truncated at 5/)
})

test('execute returns unlock confirmation even without query', async () => {
  const { ctx, getRegistered } = createFakeCtx([])
  apply(ctx, {})
  const result = await getRegistered().execute({ toolNames: ['mcp__x__a'] }, { agent: {} })
  assert.match(result.text, /Unlocked for this session/)
})
