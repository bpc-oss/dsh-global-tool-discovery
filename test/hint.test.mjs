import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

test('augments resident tool descriptions with dev_tool_search hint', async () => {
  let listener
  const ctx = {
    tools: {
      register() {
        return () => {}
      },
      schemas() {
        return []
      },
    },
    effect(fn) {
      fn()
    },
    on(event, fn) {
      if (event === 'system-prompt/assemble') listener = fn
    },
  }

  apply(ctx, {})

  const assembled = {
    tools: [
      { name: 'pwsh', description: 'Run PowerShell' },
      { name: 'str_replace_editor', description: 'Edit files' },
      { name: 'web_search', description: 'Search web' },
    ],
  }

  const result = await listener(null, { agent: {} }, async () => assembled)

  assert.match(result.tools[0].description, /dev_tool_search/)
  assert.match(result.tools[1].description, /dev_tool_search/)
  assert.doesNotMatch(result.tools[2].description, /dev_tool_search/)
})

test('does not duplicate the hint', async () => {
  let listener
  const ctx = {
    tools: {
      register() {
        return () => {}
      },
      schemas() {
        return []
      },
    },
    effect(fn) {
      fn()
    },
    on(event, fn) {
      if (event === 'system-prompt/assemble') listener = fn
    },
  }

  apply(ctx, {})

  const base = { name: 'pwsh', description: 'Run PowerShell\n\nTip: If a needed capability is not listed, call dev_tool_search first to search and unlock it.' }
  const assembled = { tools: [base] }
  const result = await listener(null, { agent: {} }, async () => assembled)

  assert.equal(result.tools[0].description.match(/dev_tool_search/g).length, 1)
})
