import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

function createCtx() {
  let listener
  const warned = []
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
    logger: {
      warn(message) {
        warned.push(message)
      },
    },
  }
  return { ctx, getListener: () => listener, warned }
}

test('augments resident tool descriptions with dev_tool_search hint', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  const assembled = {
    tools: [
      { name: 'pwsh', description: 'Run PowerShell' },
      { name: 'bash', description: 'Run Bash' },
      { name: 'str_replace_editor', description: 'Edit files' },
      { name: 'web_search', description: 'Search web' },
    ],
  }

  const result = await getListener()(null, { agent: {} }, async () => assembled)

  for (const tool of result.tools.slice(0, 3)) {
    assert.match(tool.description, /dev_tool_search/)
    assert.match(tool.description, /dev_inject_plugin/)
    assert.match(tool.description, /bootstrap presets/)
  }
  assert.doesNotMatch(result.tools[3].description, /dev_tool_search/)
})

test('does not duplicate the hint', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  const HINT = 'Tip: If a needed capability is not listed, call dev_tool_search first to search and unlock it (it becomes available from the next request in bootstrap presets). For installing or injecting a new plugin, search inject to unlock dev_inject_plugin.'
  const base = { name: 'pwsh', description: `Run PowerShell\n\n${HINT}` }
  const assembled = { tools: [base] }
  const result = await getListener()(null, { agent: {} }, async () => assembled)

  assert.equal(result.tools[0].description.match(/dev_tool_search/g).length, 1)
  assert.equal(result.tools[0].description.match(/dev_inject_plugin/g).length, 1)
})

test('preserves original assembled object immutability', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  const original = { name: 'pwsh', description: 'Run PowerShell' }
  const assembled = { tools: [original] }
  await getListener()(null, { agent: {} }, async () => assembled)

  assert.equal(original.description, 'Run PowerShell')
  assert.equal(assembled.tools[0], original)
})

test('handles defensive tool array cases', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  const nonArray = { foo: 1 }
  const nonArrayResult = await getListener()(null, { agent: {} }, async () => nonArray)
  assert.equal(nonArrayResult, nonArray)

  const assembled = { tools: [null, 'x', { name: 'pwsh', description: undefined }, { name: 'other' }] }
  const result = await getListener()(null, { agent: {} }, async () => assembled)

  assert.equal(result.tools[0], null)
  assert.equal(result.tools[1], 'x')
  assert.match(result.tools[2].description, /dev_tool_search/)
  assert.equal(result.tools[3].description, undefined)
})

test('falls back to original assembly when transform throws', async () => {
  const { ctx, getListener, warned } = createCtx()
  apply(ctx, {})

  const badTool = {}
  Object.defineProperty(badTool, 'name', {
    get() {
      throw new Error('boom')
    },
  })
  const assembled = { tools: [badTool] }
  const result = await getListener()(null, { agent: {} }, async () => assembled)

  assert.equal(result, assembled)
  assert.equal(warned.length, 1)
  assert.match(warned[0], /hint augmentation failed/)
})

test('propagates upstream next() errors', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  await assert.rejects(
    () => getListener()(null, { agent: {} }, async () => {
      throw new Error('upstream')
    }),
    /upstream/,
  )
})

test('end-to-end with a bootstrap filter keeps resident tools and hints in either order', async () => {
  const { ctx, getListener } = createCtx()
  apply(ctx, {})

  const assembled = {
    tools: [
      { name: 'bash', description: 'Run Bash' },
      { name: 'str_replace_editor', description: 'Edit files' },
      { name: 'web_search', description: 'Search web' },
    ],
  }
  const bootstrapFilter = async (a) => ({
    ...a,
    tools: a.tools.filter((t) => t.name === 'bash' || t.name === 'str_replace_editor'),
  })

  // hint outermost -> bootstrap inner
  const outer = await getListener()(null, { agent: {} }, async () => bootstrapFilter(assembled))
  // bootstrap outer -> hint inner
  const inner = await bootstrapFilter(await getListener()(null, { agent: {} }, async () => assembled))

  for (const result of [outer, inner]) {
    assert.deepEqual(result.tools.map((t) => t.name), ['bash', 'str_replace_editor'])
    for (const tool of result.tools) {
      assert.match(tool.description, /dev_tool_search/)
      assert.match(tool.description, /dev_inject_plugin/)
    }
  }
})
