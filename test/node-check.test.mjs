import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const files = ['lib/index.mjs', 'lib/session-unlock.mjs', 'scripts/check-private.mjs']

for (const file of files) {
  test(`node --check ${file}`, () => {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'pipe' }))
  })
}
