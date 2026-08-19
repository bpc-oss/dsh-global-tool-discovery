#!/usr/bin/env node
/**
 * Privacy scanner for dsh-global-tool-discovery.
 *
 * Fails the release if any tracked source/doc file contains machine-specific
 * paths or obvious secret patterns. Intended to run in CI before publish.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ignoredDirs = new Set(['node_modules', '.git', 'coverage', 'dist'])
const textExtensions = new Set(['.mjs', '.js', '.json', '.md', '.yml', '.yaml', '.txt', '.ts'])

const patterns = [
  { name: 'Windows user home', re: /C:\\Users\\/i },
  { name: 'Windows drive absolute', re: /[A-Z]:\\/i },
  { name: 'Unix home', re: /\/home\/[^/]+\//i },
  { name: 'Administrator username', re: /Administrator/i },
  { name: 'DSH private profile path', re: /\.dsh\\profiles\\/i },
  { name: 'Private key marker', re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/i },
  { name: 'API key assignment', re: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+/i },
]

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...walk(full))
    } else if (entry.isFile() && textExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(full)
    }
  }
  return files
}

let violations = 0
for (const file of walk(root)) {
  // Do not scan the scanner itself: its pattern literals would self-flag.
  if (file.endsWith(`${sep}check-private.mjs`)) continue
  const content = readFileSync(file, 'utf8')
  for (const pattern of patterns) {
    const match = content.match(pattern.re)
    if (match) {
      violations += 1
      const rel = relative(root, file).split(sep).join('/')
      console.error(`[private] ${rel}: ${pattern.name} -> ${match[0].slice(0, 80)}`)
    }
  }
}

if (violations > 0) {
  console.error(`\nPrivacy scan failed with ${violations} violation(s).`)
  process.exit(1)
}

console.log('Privacy scan passed.')
