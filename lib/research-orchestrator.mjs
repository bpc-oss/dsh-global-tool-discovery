/**
 * research-orchestrator — Phase 1: unified normalization, retry, degrade.
 */

export const name = 'research-orchestrator'
export const inject = ['tools']

import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp'
const EXA_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
}

const DEFAULT_SEARXNG_INSTANCES = [
  { url: 'https://searx.be', priority: 'normal' },
  { url: 'https://searx.work', priority: 'normal' },
  { url: 'https://baresearch.org', priority: 'normal' },
]

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
      if (error) resolve({ ok: false, output: String(error?.message || error), code: error?.code || 'unknown' })
      else resolve({ ok: true, output: stdout, code: null })
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

export function isRetryableError(code) {
  return code === 'timeout' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 5
}

export async function runWithRetry(fn, { maxRetries = 1, delayMs = 2000 } = {}) {
  let last
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn()
    if (result.ok) return result
    last = result
    if (!isRetryableError(result.code) || attempt === maxRetries) break
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return last
}

export function dedupKey(title, url) {
  const raw = `${title || ''}|${url || ''}`
  const hash = createHash('sha256').update(raw, 'utf8').digest('hex')
  return `sha256:${hash}`
}

export function normalizePapers(items) {
  return (Array.isArray(items) ? items : []).map((p) => ({
    title: p.title || '',
    url: p.url || p.doi || '',
    snippet: Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || '',
    publishedAt: p.year ? String(p.year) : '',
    dedupKey: dedupKey(p.title, p.url),
  }))
}

export function normalizeExaItems(parsed) {
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
      return { title: title || '', url: url || '', snippet: snippet || '', publishedAt: '', dedupKey: dedupKey(title, url) }
    })
    .filter(Boolean)
}

export function normalizeSearxngItems(items) {
  return (Array.isArray(items) ? items : []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    publishedAt: r.publishedDate || '',
    dedupKey: dedupKey(r.title, r.url),
  }))
}

export function normalizeCodeItems(items) {
  return (Array.isArray(items) ? items : []).map((r) => ({
    title: r.name || '',
    url: r.url || '',
    snippet: r.description || '',
    publishedAt: '',
    dedupKey: dedupKey(r.name, r.url),
  }))
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

async function searxngSearch(query, limit, instances) {
  const sorted = [...instances].sort((a, b) => {
    const pa = a.priority === 'high' ? 0 : 1
    const pb = b.priority === 'high' ? 0 : 1
    return pa - pb
  })
  for (const inst of sorted) {
    try {
      const url = `${inst.url}/search?q=${encodeURIComponent(query)}&format=json&language=en&pageno=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (research-orchestrator)' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const text = await res.text()
      if (!text.trim().startsWith('{')) continue
      const parsed = JSON.parse(text)
      const results = Array.isArray(parsed.results) ? parsed.results : []
      if (results.length > 0) return normalizeSearxngItems(results.slice(0, limit))
    } catch {
      // try next instance
    }
  }
  return []
}

async function runResearch(query, sources, limit, config) {
  const grouped = []
  const errors = []
  const knowledgeGaps = []

  if (sources.includes('papers')) {
    const tmpFile = join(tmpdir(), `litkit-${randomUUID()}.json`)
    const litkitOut = await runWithRetry(
      () => runAsync('litkit', ['search', query, '-l', String(limit), '-e', 'json', '-o', tmpFile], 120000),
      config.retry,
    )
    if (litkitOut.ok) {
      try {
        const raw = await readFile(tmpFile, 'utf8')
        const parsed = safeJson(raw)
        const items = Array.isArray(parsed) ? parsed : parsed?.results
        grouped.push({ source: 'papers', active: true, results: normalizePapers(items).slice(0, limit) })
      } catch {
        grouped.push({ source: 'papers', active: true, results: [] })
      } finally {
        await rm(tmpFile, { force: true }).catch(() => {})
      }
    } else {
      errors.push({ source: 'papers', active: false, status: 'timeout', error: litkitOut.output.slice(0, 200), retryCount: config.retry?.maxRetries ?? 1, lastAttempt: new Date().toISOString() })
    }
  }

  if (sources.includes('web')) {
    const exaResult = await runWithRetry(
      async () => {
        try {
          const parsed = await exaMCP(query, limit)
          if (parsed && parsed.result && !parsed.error) return { ok: true, output: parsed, code: null }
          return { ok: false, output: null, code: 'timeout' }
        } catch (e) {
          return { ok: false, output: null, code: 'timeout' }
        }
      },
      config.retry,
    )
    if (exaResult.ok && exaResult.output) {
      grouped.push({ source: 'web', active: true, results: normalizeExaItems(exaResult.output).slice(0, limit) })
    } else {
      errors.push({ source: 'web', active: false, status: 'unavailable', error: 'Exa MCP call failed', retryCount: config.retry?.maxRetries ?? 1, lastAttempt: new Date().toISOString() })
    }
  }

  if (sources.includes('searxng')) {
    const sxResult = await runWithRetry(
      async () => {
        const items = await searxngSearch(query, limit, config.searxngInstances)
        if (items.length > 0) return { ok: true, output: items, code: null }
        return { ok: false, output: null, code: 'timeout' }
      },
      config.retry,
    )
    if (sxResult.ok && sxResult.output) {
      grouped.push({ source: 'searxng', active: true, results: sxResult.output })
    } else {
      errors.push({ source: 'searxng', active: false, status: 'unavailable', error: 'no results / instances blocked', retryCount: config.retry?.maxRetries ?? 1, lastAttempt: new Date().toISOString() })
    }
  }

  if (sources.includes('code') || sources.includes('github')) {
    const ghOut = await runWithRetry(
      () => runAsync('gh', ['search', 'repos', query, '--limit', String(limit), '--json', 'name,url,description,stargazersCount'], 30000),
      config.retry,
    )
    if (ghOut.ok) {
      const parsed = safeJson(ghOut.output)
      grouped.push({ source: 'code', active: true, results: normalizeCodeItems(parsed).slice(0, limit) })
    } else {
      errors.push({ source: 'code', active: false, status: 'timeout', error: ghOut.output.slice(0, 200), retryCount: config.retry?.maxRetries ?? 1, lastAttempt: new Date().toISOString() })
    }
  }

  if (grouped.length === 0 && errors.length > 0) {
    knowledgeGaps.push(`No sources returned results for "${query}".`)
  }

  return { query, sources: grouped, errors, knowledgeGaps }
}

function renderResult(data) {
  const lines = []
  lines.push(`Research orchestration results for "${data.query}"`)
  for (const group of data.sources) {
    lines.push(`\n## ${group.source}`)
    for (const r of group.results) {
      lines.push(`- ${r.title || '?'}: ${r.url || '?'}`)
      if (r.snippet) lines.push(`  ${r.snippet.slice(0, 200)}`)
    }
  }
  for (const err of data.errors) {
    lines.push(`\n[${err.source}] ${err.status}: ${err.error}`)
  }
  if (data.knowledgeGaps.length) {
    lines.push(`\nKnowledge gaps: ${data.knowledgeGaps.join('; ')}`)
  }
  return lines.join('\n')
}

export function apply(ctx, config = {}) {
  const jobs = new Map()
  const searxngInstances = Array.isArray(config.searxngInstances) && config.searxngInstances.length > 0
    ? config.searxngInstances
    : DEFAULT_SEARXNG_INSTANCES
  const retry = config.retry || { maxRetries: 1, delayMs: 2000 }

  ctx.effect(() => {
    const disposeStart = ctx.tools.register({
      name: 'research_orchestrator',
      description: 'Start a background multi-source research job. Returns a jobId immediately; use research_job_get to retrieve results. Sources: papers (litkit), web (Exa), searxng, code (GitHub).',
      timeoutMs: 10000,
      parameters: toJsonSchema({
        query: { type: 'string', required: true, description: 'search query' },
        sources: { type: 'array', required: false, items: { type: 'string' }, description: 'sources to include: papers, web, searxng, code' },
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

        runResearch(query, sources, limit, { searxngInstances, retry })
          .then((data) => {
            jobs.set(jobId, { status: 'complete', result: renderResult(data), data, error: null, startedAt: jobs.get(jobId)?.startedAt })
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
