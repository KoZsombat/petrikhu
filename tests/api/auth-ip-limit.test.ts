// Login: 30 attempts per IP / 15 minutes. Separate file (separate process), because the limiter is module state.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer

before(async () => {
  server = await startTestServer()
})
after(() => server.close())

test('the 31st attempt per IP gives 429, for any account', async () => {
  for (let i = 0; i < 30; i += 1) {
    // Always a different username, so the per-account limit does not interfere.
    const res = await server.client().post('/api/auth/login', { login: `nincs-${i}`, password: 'x' })
    assert.equal(res.status, 401, `attempt ${i + 1}`)
  }
  const blocked = await server.client().post('/api/auth/login', DEMO.reviewer)
  assert.equal(blocked.status, 429)
  assert.deepEqual(blocked.body, { error: 'too_many_attempts' })
})
