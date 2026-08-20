import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'
import { sourceAdapters, registerSourceAdapter } from '../lib/registry.mjs'

function createCtx() {
  const tools = []
  const ctx = {
    tools: {
      register(def) {
        tools.push(def)
        return () => {}
      },
      schemas() {
        return []
      },
    },
    skills: {
      async list() {
        return []
      },
    },
    effect(fn) {
      fn()
    },
    on() {},
    logger: { warn() {} },
  }
  return { ctx, tools }
}

test('bundle default mounts core, research and knowledge', async () => {
  const { ctx, tools } = createCtx()
  await apply(ctx, {})
  const names = tools.map((t) => t.name)
  assert.ok(names.includes('dev_tool_search'))
  assert.ok(names.includes('research_orchestrator'))
  assert.ok(names.includes('research_job_get'))
  assert.ok(names.includes('research_memory_query'))
  assert.ok(names.includes('knowledge_ingest'))
})

test('bundle with enableResearch false skips research tools', async () => {
  const { ctx, tools } = createCtx()
  await apply(ctx, { enableResearch: false })
  const names = tools.map((t) => t.name)
  assert.ok(names.includes('dev_tool_search'))
  assert.ok(names.includes('knowledge_ingest'))
  assert.ok(!names.includes('research_orchestrator'))
})

test('bundle with enableKnowledge false skips knowledge tools', async () => {
  const { ctx, tools } = createCtx()
  await apply(ctx, { enableKnowledge: false })
  const names = tools.map((t) => t.name)
  assert.ok(names.includes('dev_tool_search'))
  assert.ok(names.includes('research_orchestrator'))
  assert.ok(!names.includes('knowledge_ingest'))
})

test('registry is shared and registerSourceAdapter works', () => {
  const before = sourceAdapters.size
  registerSourceAdapter('test-source', { search: async () => [] })
  assert.equal(sourceAdapters.size, before + 1)
})
