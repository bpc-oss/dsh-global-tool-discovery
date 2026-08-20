/**
 * research-orchestrator — M1 最小闭环实现（异步任务版 + 直接 Exa MCP）。
 *
 * research_orchestrator 启动后台研究任务并立即返回 jobId；
 * research_job_get 用于查询任务状态和最终结果。
 */

export const name = 'research-orchestrator'
export const inject = ['tools']

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp'
const EXA_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
}

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

async function exaMCP(query, numResults) {
  const init = async () => {
    const res = await fetch(EXA_MCP_URL, {
      method: 'POST',
      headers: EXA_HEADERS,
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dsh-research', version: '0.1.0' } },
      }),
    })
    return res.text()
  }

  const call = async () => {
    const res = await fetch(EXA_MCP_URL, {
      method: 'POST',
      headers: EXA_HEADERS,
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'web_search_exa', arguments: { query, numResults } },
      }),
    })
    const text = await res.text()
    for (const block of text.split('\n\n')) {
      const line = block.replace(/^event:\s*message\n?/, '').replace(/^data:\s*/, '').trim()
      if (line) {
        try { return JSON.parse(line) } catch { /* skip */ }
      }
    }
    return null
  }

  await init()
  return call()
}

function parseExaContent(parsed) {
  const texts = []
  if (parsed?.result?.content && Array.isArray(parsed.result.content)) {
    for (const block of parsed.result.content) {
      if (block && typeof block.text === 'string') texts.push(block.text)
    }
  }
  const allText = texts.join('\n\n---\n\n')
  if (!allText) return []
  return allText
    .split(/\n\s*---\s*\n/)
    .map((chunk) => {
      const title = chunk.match(/Title:\s*(.+)/)?.[1]?.trim()
      const url = chunk.match(/URL:\s*(.+)/)?.[1]?.trim()
      const snippet = chunk.match(/Highlights:\s*([\s\S]*)$/)?.[1]?.trim().slice(0, 300)
      if (!title && !url) return null
      return { title, url, snippet }
    })
    .filter(Boolean)
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
    const tmpFile = join(tmpdir(), `litkit-${randomUUID()}.json`)
    const litkitOut = await runAsync('litkit', ['search', query, '-l', String(limit), '-e', 'json', '-o', tmpFile], 120000)
    if (litkitOut.ok) {
      status.push({ source: 'papers', active: true })
      sections.push(`## Papers (litkit)`)
      try {
        const raw = await readFile(tmpFile, 'utf8')
        const parsed = safeJson(raw)
        const items = Array.isArray(parsed) ? parsed : parsed?.results
        if (Array.isArray(items)) {
          for (const p of items.slice(0, limit)) {
            const authors = Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || ''
            sections.push(`- ${p.title || '?'}${authors ? ` (${authors})` : ''}`)
            if (p.url) sections.push(`  ${p.url}`)
          }
        } else {
          sections.push(`  ${raw.slice(0, 500)}`)
        }
      } catch {
        sections.push(`  ${litkitOut.output.slice(0, 500)}`)
      } finally {
        await rm(tmpFile, { force: true }).catch(() => {})
      }
    } else {
      status.push({ source: 'papers', active: false, info: litkitOut.output })
    }
  }

  if (sources.includes('web')) {
    try {
      const exaResult = await exaMCP(query, limit)
      if (exaResult && exaResult.result && !exaResult.error) {
        status.push({ source: 'web', active: true })
        sections.push(`\n## Web (Exa)`)
        const items = parseExaContent(exaResult)
        if (items.length > 0) {
          for (const r of items.slice(0, limit)) {
            sections.push(`- ${r.title || '?'}: ${r.url || '?'}`)
            if (r.snippet) sections.push(`  ${r.snippet.slice(0, 200)}`)
          }
        } else {
          sections.push(`  (no results)`)
        }
      } else {
        status.push({ source: 'web', active: false, info: 'Exa MCP call failed' })
      }
    } catch (e) {
      status.push({ source: 'web', active: false, info: String(e?.message || e) })
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
