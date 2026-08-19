import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/skills.mjs'

function createFakeCtx({ skills = [], definitions = new Map() } = {}) {
  const registered = []
  const disposed = []
  let assembleListener
  let cleanup
  const ctx = {
    tools: {
      register(def) {
        registered.push(def)
        return () => disposed.push(def.name)
      },
    },
    skills: {
      async list() {
        return skills
      },
      async get(name) {
        return definitions.get(name)
      },
    },
    effect(fn) {
      cleanup = fn()
      assert.equal(typeof cleanup, 'function')
      return cleanup
    },
    on(event, fn) {
      if (event === 'system-prompt/assemble') assembleListener = fn
    },
    logger: {
      warn() {},
    },
  }
  return { ctx, registered, disposed, getAssembleListener: () => assembleListener, getCleanup: () => cleanup }
}

function agent(preset = 'dev', injected = []) {
  return {
    session: {
      header: { cwd: 'C:/work', agentPreset: preset },
    },
    inject(message) {
      injected.push(message)
    },
  }
}

test('apply registers skill_search and skill_load', () => {
  const { ctx, registered } = createFakeCtx()
  apply(ctx, {})
  assert.deepEqual(registered.map((t) => t.name), ['skill_search', 'skill_load'])
})

test('skill_search filters non-model-invocable skills', async () => {
  const skills = [
    { name: 'ok-skill', description: 'allowed', invocation: { modelInvocable: true } },
    { name: 'no-skill', description: 'blocked', invocation: { modelInvocable: false } },
  ]
  const { ctx, registered } = createFakeCtx({ skills })
  apply(ctx, {})
  const result = await registered[0].execute({ query: 'skill' }, { agent: agent() })
  assert.match(result.text, /ok-skill/)
  assert.doesNotMatch(result.text, /no-skill/)
})

test('skill_search is disabled for disabled presets', async () => {
  const { ctx, registered } = createFakeCtx()
  apply(ctx, { disabledPresets: ['employee-ops'] })
  const result = await registered[0].execute({ query: 'anything' }, { agent: agent('employee-ops') })
  assert.match(result.text, /disabled for this preset/)
})

test('skill_load rejects non-model-invocable skills', async () => {
  const definitions = new Map([
    ['no-skill', { name: 'no-skill', content: 'body', invocation: { modelInvocable: false } }],
  ])
  const { ctx, registered } = createFakeCtx({ definitions })
  apply(ctx, {})
  const result = await registered[1].execute({ name: 'no-skill' }, { agent: agent() })
  assert.match(result.text, /not available for model invocation/)
})

test('skill_load truncates oversized body', async () => {
  const body = 'x'.repeat(200)
  const definitions = new Map([
    ['big-skill', { name: 'big-skill', content: body, invocation: { modelInvocable: true } }],
  ])
  const { ctx, registered } = createFakeCtx({ definitions })
  apply(ctx, { maxBodyChars: 100 })

  const injected = []
  const result = await registered[1].execute({ name: 'big-skill' }, { agent: agent('dev', injected) })
  assert.match(result.text, /truncated at 100/)
  assert.equal(injected.length, 1)
  assert.match(injected[0].content[0].text, /\[skill body truncated at 100 characters\]/)
})

test('assemble filter removes skill tools for disabled presets', async () => {
  const { ctx, getAssembleListener } = createFakeCtx()
  apply(ctx, { disabledPresets: ['employee-ops'] })
  const listener = getAssembleListener()

  const assembled = {
    tools: [
      { name: 'skill_search' },
      { name: 'skill_load' },
      { name: 'pwsh' },
    ],
  }
  const result = await listener(null, { agent: agent('employee-ops') }, async () => assembled)
  assert.deepEqual(result.tools.map((t) => t.name), ['pwsh'])
})

test('assemble filter leaves enabled presets unchanged', async () => {
  const { ctx, getAssembleListener } = createFakeCtx()
  apply(ctx, { disabledPresets: ['employee-ops'] })
  const listener = getAssembleListener()

  const assembled = {
    tools: [
      { name: 'skill_search' },
      { name: 'skill_load' },
      { name: 'pwsh' },
    ],
  }
  const result = await listener(null, { agent: agent('dev') }, async () => assembled)
  assert.deepEqual(result.tools.map((t) => t.name), ['skill_search', 'skill_load', 'pwsh'])
})

test('effect disposer cleans both skill tools', () => {
  const { ctx, disposed, getCleanup } = createFakeCtx()
  apply(ctx, {})
  getCleanup()()
  assert.deepEqual(disposed.sort(), ['skill_load', 'skill_search'])
})
