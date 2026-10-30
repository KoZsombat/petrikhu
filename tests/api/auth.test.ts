// Belépés: siker, hiba, munkamenet-azonosító csere, fiókonkénti korlát (8 / 15 perc).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer

before(async () => {
  server = await startTestServer()
})
after(() => server.close())

test('sikeres belépés: süti és felhasználó', async () => {
  const client = server.client()
  const res = await client.post('/api/auth/login', DEMO.reviewer)
  assert.equal(res.status, 200)
  const body = res.body as { user: { displayName: string; permissions: string[] } }
  assert.equal(body.user.displayName, 'Nagy Péter')
  assert.ok(body.user.permissions.includes('pnw_review_news'))
  assert.match(res.headers.get('set-cookie') ?? '', /pnw\.sid=.*HttpOnly.*SameSite=Lax/i)
  const me = await client.get('/api/auth/me')
  assert.equal(me.status, 200)
})

test('a felhasználónév kis-nagybetűtől független', async () => {
  const res = await server.client().post('/api/auth/login', { login: 'HELYETTES', password: DEMO.reviewer.password })
  assert.equal(res.status, 200)
})

test('hibás jelszó és ismeretlen fiók: ugyanaz a válasz', async () => {
  const wrong = await server.client().post('/api/auth/login', { login: DEMO.director.login, password: 'rossz' })
  const unknown = await server.client().post('/api/auth/login', { login: 'nincs-ilyen', password: 'rossz' })
  assert.equal(wrong.status, 401)
  assert.deepEqual(wrong.body, { error: 'invalid_credentials' })
  assert.deepEqual(unknown.body, wrong.body)
})

test('üres mezők', async () => {
  const res = await server.client().post('/api/auth/login', { login: '', password: '' })
  assert.equal(res.status, 401)
  assert.deepEqual(res.body, { error: 'empty_fields' })
})

test('belépéskor új munkamenet-azonosító, a régi érvénytelen', async () => {
  const client = await server.login(DEMO.director)
  const first = client.cookie
  await client.post('/api/auth/login', DEMO.director)
  assert.notEqual(client.cookie, first)
  const stale = server.client()
  stale.cookie = first
  assert.equal((await stale.get('/api/auth/me')).status, 401)
  assert.equal((await client.get('/api/auth/me')).status, 200)
})

test('kijelentkezés után a munkamenet nem él', async () => {
  const client = await server.login(DEMO.author)
  const cookie = client.cookie
  assert.equal((await client.post('/api/auth/logout')).status, 200)
  const stale = server.client()
  stale.cookie = cookie
  assert.equal((await stale.get('/api/auth/me')).status, 401)
})

test('fiókonként 8 sikertelen próba után 429, helyes jelszóval is', async () => {
  const login = 'mk.vezeto'
  for (let i = 0; i < 8; i += 1) {
    const res = await server.client().post('/api/auth/login', { login, password: `rossz-${i}` })
    assert.equal(res.status, 401, `próba ${i + 1}`)
  }
  const blocked = await server.client().post('/api/auth/login', DEMO.author)
  assert.equal(blocked.status, 429)
  assert.deepEqual(blocked.body, { error: 'too_many_attempts' })
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
  // Más fiók ugyanarról az IP-ről még beléphet.
  assert.equal((await server.client().post('/api/auth/login', DEMO.reviewer)).status, 200)
})

// Az IP-korlát (30) az egész fájlra közös: ez a teszt kevés próbával bizonyít (4 + 5 > 8).
test('a sikeres belépés nullázza a fiók számlálóját', async () => {
  const login = DEMO.director.login
  for (let i = 0; i < 4; i += 1) await server.client().post('/api/auth/login', { login, password: 'rossz' })
  assert.equal((await server.client().post('/api/auth/login', DEMO.director)).status, 200)
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await server.client().post('/api/auth/login', { login, password: 'rossz' })).status, 401)
  }
})
