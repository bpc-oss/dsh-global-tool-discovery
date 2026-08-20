import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/knowledge-ingest.mjs'

function createCtx() {
  const tools = []
  const ctx = {
    tools: {
      register(def) {
        tools.push(def)
        return () => {}
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

test('apply registers knowledge_ingest', () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  assert.deepEqual(tools.map((t) => t.name), ['knowledge_ingest'])
})

test('knowledge_ingest rejects invalid skill name', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const result = await tools[0].execute({ name: 'Bad Name', description: 'x', content: 'x' }, { agent: {} })
  assert.match(result.text, /Invalid name/)
})

test('knowledge_ingest requires description and content', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const result = await tools[0].execute({ name: 'ok-skill', description: '', content: '' }, { agent: {} })
  assert.match(result.text, /description and content are required/)
})

test('knowledge_ingest plugin mode dry-run returns file list', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const result = await tools[0].execute({ mode: 'plugin', name: 'demo-plugin', description: 'demo', dryRun: true }, { agent: {} })
  assert.match(result.text, /Plugin skeleton dry-run/)
  assert.match(result.text, /package.json/)
  assert.match(result.text, /index\.mjs/)
})

test('knowledge_ingest memory mode appends summary', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const result = await tools[0].execute({ mode: 'memory', name: 'research-note', content: 'summary', sources: ['https://x'] }, { agent: {} })
  assert.match(result.text, /Research memory appended/)
})

