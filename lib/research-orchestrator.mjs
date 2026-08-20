/**
 * research-orchestrator — M1 最小闭环实现（异步任务版）。
 *
 * research_orchestrator 启动后台研究任务并立即返回 jobId；
 * research_job_get 用于查询任务状态和最终结果。
 */

export const name = 'research-orchestrator'
export const inject = ['tools']

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'

function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    if (meta.items) prop.items = meta.items
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

function runAsync(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    }, (error, stdout) => {
      if (error) resolve({ ok: false, output: String(error?.message || error) })
      else resolve({ ok: true, output: stdout })
    })
  })
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function runResearch(query, sources, limit) {
  const sections = []
  const status = []

  if (sources.includes('health')) {
    const doctor = await runAsync('agent-reach', ['doctor', '--json'], 10000)
    if (doctor.ok) {
      const parsed = safeJson(doctor.output)
      status.push({ source: 'agent-reach', active: true, info: parsed?.summary || 'doctor available' })
    } else {
      status.push({ source: 'agent-reach', active: false, info: doctor.output })
    }
  }

  if (sources.includes('papers')) {
    const litkitOut = await runAsync('litkit', ['search', query, '-l', String(limit), '-e', 'json'], 120000)
    if (litkitOut.ok) {
      status.push({ source: 'papers', active: true })
      sections.push(`## Papers (litkit)`)
      const parsed = safeJson(litkitOut.output)
      const items = Array.isArray(parsed) ? parsed : parsed?.results
      if (Array.isArray(items)) {
        for (const p of items.slice(0, limit)) {
          const authors = Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || ''
          sections.push(`- ${p.title || '?'}${authors ? ` (${authors})` : ''}`)
          if (p.url) sections.push(`  ${p.url}`)
        }
      } else {
        sections.push(`  ${litkitOut.output.slice(0, 500)}`)
      }
    } else {
      status.push({ source: 'papers', active: false, info: litkitOut.output })
    }
  }

  if (sources.includes('web')) {
    const argsPayload = JSON.stringify({ query, numResults: limit })
    const exaOut = await runAsync('mcporter', ['call', 'exa.web_search_exa', '--args', argsPayload], 90000)
    if (exaOut.ok) {
      status.push({ source: 'web', active: true })
      sections.push(`\n## Web (Exa)`)
      const parsed = safeJson(exaOut.output)
      const results = parsed?.results || parsed?.content || []
      if (Array.isArray(results)) {
        for (const r of results.slice(0, limit)) {
          sections.push(`- ${r.title || '?'}: ${r.url || '?'}`)
          if (r.snippet) sections.push(`  ${r.snippet.slice(0, 200)}`)
        }
      } else {
        sections.push(`  ${exaOut.output.slice(0, 500)}`)
      }
    } else {
      status.push({ source: 'web', active: false, info: exaOut.output })
    }
  }

  const summary = status.map(s => `${s.source}: ${s.active ? 'ok' : 'failed'}`).join(', ')
  const body = sections.length > 0 ? sections.join('\n') : '_No sources returned results._'
  return `Research orchestration results for "${query}"\nSource status: ${summary}\n\n${body}`
}

export function apply(ctx) {
  const jobs = new Map()

  ctx.effect(() => {
    const disposeStart = ctx.tools.register({
      name: 'research_orchestrator',
      description: 'Start a background multi-source research job. Returns a jobId immediately; use research_job_get to retrieve results. Sources: papers (litkit), web (Exa), health (agent-reach).',
      timeoutMs: 10000,
      parameters: toJsonSchema({
        query: { type: 'string', required: true, description: 'search query' },
        sources: { type: 'array', required: false, items: { type: 'string' }, description: 'sources to include: papers, web, health' },
        limit: { type: 'integer', required: false, default: 10 },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        const query = typeof args.query === 'string' ? args.query.trim() : ''
        const sources = Array.isArray(args.sources) ? args.sources : ['papers', 'web']
        const limit = Number.isInteger(args.limit) && args.limit > 0 ? args.limit : 10
        if (query.length === 0) return { text: 'Query is required.' }

        const jobId = randomUUID()
        jobs.set(jobId, { status: 'running', result: null, error: null, startedAt: Date.now() })

        runResearch(query, sources, limit)
          .then((result) => {
            jobs.set(jobId, { status: 'complete', result, error: null, startedAt: jobs.get(jobId)?.startedAt })
          })
          .catch((error) => {
            jobs.set(jobId, { status: 'failed', result: null, error: String(error?.message || error), startedAt: jobs.get(jobId)?.startedAt })
          })

        return { text: `Research job started.\njobId: ${jobId}\n\nUse research_job_get({"jobId": "${jobId}"}) to retrieve results.` }
      },
    })

    const disposeGet = ctx.tools.register({
      name: 'research_job_get',
      description: 'Get status or result of a background research job started by research_orchestrator.',
      timeoutMs: 10000,
      parameters: toJsonSchema({
        jobId: { type: 'string', required: true, description: 'job id from research_orchestrator' },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        const jobId = typeof args.jobId === 'string' ? args.jobId.trim() : ''
        const job = jobs.get(jobId)
        if (!job) return { text: `Job "${jobId}" not found.` }
        if (job.status === 'running') return { text: `Job "${jobId}" is still running.` }
        if (job.status === 'failed') return { text: `Job "${jobId}" failed: ${job.error}` }
        return { text: `Job "${jobId}" complete.\n\n${job.result}` }
      },
    })

    return () => {
      disposeStart()
      disposeGet()
    }
  })
}
