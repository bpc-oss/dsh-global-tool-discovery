import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

function createFakeCtx() {
  let registered = null
  let disposed = false
  const ctx = {
    tools: {
      register(def) {
        registered = def
        return () => {
          disposed = true
        }
      },
      schemas() {
        return []
      },
    },
    effect(fn) {
      const cleanup = fn()
      assert.equal(typeof cleanup, 'function')
    },
    on() {},
  }
  return { ctx, getRegistered: () => registered, isDisposed: () => disposed }
}

test('apply registers dev_tool_search with valid schema', () => {
  const { ctx, getRegistered } = createFakeCtx()
  apply(ctx, { maxResults: 10, residentTools: ['pwsh', 'str_replace_editor'] })

  const tool = getRegistered()
  assert.equal(tool.name, 'dev_tool_search')
  assert.equal(tool.parameters.type, 'object')
  assert.equal(tool.parameters.properties.query.type, 'string')
  assert.equal(tool.parameters.properties.toolNames.type, 'array')
  assert.deepEqual(tool.parameters.properties.toolNames.items, { type: 'string' })
  assert.equal(tool.output.schema.type, 'object')
  assert.match(tool.description, /SESSION-SCOPED/)
  assert.match(tool.description, /pwsh/)
})

test('apply disables session-scoped wording when configured', () => {
  const { ctx, getRegistered } = createFakeCtx()
  apply(ctx, { sessionScoped: false, maxResults: 5 })
  const tool = getRegistered()
  assert.doesNotMatch(tool.description, /SESSION-SCOPED/)
})
