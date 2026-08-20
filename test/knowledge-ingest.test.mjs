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
  assert.match(result.text, /Invalid skill name/)
})

test('knowledge_ingest requires description and content', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const result = await tools[0].execute({ name: 'ok-skill', description: '', content: '' }, { agent: {} })
  assert.match(result.text, /description and content are required/)
})
