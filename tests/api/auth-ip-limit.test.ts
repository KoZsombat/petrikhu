// Belépés: IP-nként 30 próba / 15 perc. Külön fájl (külön folyamat), mert a korlátozó a modul állapota.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer

before(async () => {
  server = await startTestServer()
})
after(() => server.close())

test('IP-nként a 31. próba 429, akármelyik fiókra', async () => {
  for (let i = 0; i < 30; i += 1) {
    // Mindig más fióknév, hogy a fiókonkénti korlát ne szóljon közbe.
    const res = await server.client().post('/api/auth/login', { login: `nincs-${i}`, password: 'x' })
    assert.equal(res.status, 401, `próba ${i + 1}`)
  }
  const blocked = await server.client().post('/api/auth/login', DEMO.reviewer)
  assert.equal(blocked.status, 429)
  assert.deepEqual(blocked.body, { error: 'too_many_attempts' })
})
