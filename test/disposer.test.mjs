import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.mjs'

test('apply registers through ctx.effect and returns disposer', () => {
  let disposed = false
  let effectCalled = false
  const ctx = {
    tools: {
      register() {
        return () => {
          disposed = true
        }
      },
      schemas() {
        return []
      },
    },
    effect(fn) {
      effectCalled = true
      const cleanup = fn()
      assert.equal(typeof cleanup, 'function')
      cleanup()
    },
  }

  apply(ctx, {})

  assert.equal(effectCalled, true)
  assert.equal(disposed, true)
})
