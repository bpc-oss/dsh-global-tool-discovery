/**
 * ASI loop demo.
 *
 * Demonstrates:
 *   detect gap -> research -> internalize -> verify -> reuse
 *
 * Run: node examples/asi-loop.mjs
 */

import { apply as applyResearch } from '../lib/research.mjs'
import { apply as applyKnowledge } from '../lib/knowledge.mjs'

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

// 1. Research orchestrator
const { ctx, tools } = createCtx()
applyResearch(ctx, {})

const start = await tools[0].execute({ query: 'example research topic', sources: [], limit: 2 }, { agent: {} })
const jobId = start.text.match(/jobId: ([a-f0-9-]+)/)?.[1]
await new Promise((r) => setTimeout(r, 100))
const result = await tools[1].execute({ jobId }, { agent: {} })
console.log('=== RESEARCH ===')
console.log(result.text)

// 2. Knowledge ingest
const { ctx: kctx, tools: ktools } = createCtx()
applyKnowledge(kctx, {})
const ingest = await ktools[0].execute({
  mode: 'skill',
  name: `asi-demo-${Date.now().toString(36)}`,
  description: 'ASI loop demo skill',
  content: result.text,
  sources: ['https://github.com/bpc-oss/dsh-global-tool-discovery'],
}, { agent: {} })
console.log('\n=== INGEST ===')
console.log(ingest.text)

// 3. Verify via skill search (simulated through skills registry)
const { ctx: sctx, tools: stools } = createCtx()
// The real loop would use skill_search; here we just print the created path.
console.log('\n=== VERIFY ===')
console.log('Verify with skill_search/skill_load (in real DSH session).')

