import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/research-orchestrator.mjs'

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

test('apply registers research_orchestrator and research_job_get', () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  assert.deepEqual(tools.map((t) => t.name), ['research_orchestrator', 'research_job_get'])
})

test('research_orchestrator starts a job and returns jobId (no external sources)', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})

  const start = await tools[0].execute({ query: 'test', sources: [], limit: 1 }, { agent: {} })
  const jobId = start.text.match(/jobId: ([a-f0-9-]+)/)?.[1]
  assert.ok(jobId)

  // Wait for the no-source job to settle.
  await new Promise((r) => setTimeout(r, 100))
  const status = await tools[1].execute({ jobId }, { agent: {} })
  assert.match(status.text, /complete/)
})

test('research_job_get reports unknown job', async () => {
  const { ctx, tools } = createCtx()
  apply(ctx, {})
  const status = await tools[1].execute({ jobId: 'missing' }, { agent: {} })
  assert.match(status.text, /not found/)
})
