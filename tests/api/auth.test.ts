// Login: success, failure, session id rotation, per-account limit (8 / 15 min).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer

before(async () => {
  server = await startTestServer()
})
after(() => server.close())

test('successful login: cookie and user', async () => {
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

test('the username is case-insensitive', async () => {
  const res = await server.client().post('/api/auth/login', { login: 'HELYETTES', password: DEMO.reviewer.password })
  assert.equal(res.status, 200)
})

test('wrong password and unknown account: the same response', async () => {
  const wrong = await server.client().post('/api/auth/login', { login: DEMO.director.login, password: 'rossz' })
  const unknown = await server.client().post('/api/auth/login', { login: 'nincs-ilyen', password: 'rossz' })
  assert.equal(wrong.status, 401)
  assert.deepEqual(wrong.body, { error: 'invalid_credentials' })
  assert.deepEqual(unknown.body, wrong.body)
})

test('empty fields', async () => {
  const res = await server.client().post('/api/auth/login', { login: '', password: '' })
  assert.equal(res.status, 401)
  assert.deepEqual(res.body, { error: 'empty_fields' })
})

test('new session id on login, the old one is invalid', async () => {
  const client = await server.login(DEMO.director)
  const first = client.cookie
  await client.post('/api/auth/login', DEMO.director)
  assert.notEqual(client.cookie, first)
  const stale = server.client()
  stale.cookie = first
  assert.equal((await stale.get('/api/auth/me')).status, 401)
  assert.equal((await client.get('/api/auth/me')).status, 200)
})

test('the session is dead after logout', async () => {
  const client = await server.login(DEMO.author)
  const cookie = client.cookie
  assert.equal((await client.post('/api/auth/logout')).status, 200)
  const stale = server.client()
  stale.cookie = cookie
  assert.equal((await stale.get('/api/auth/me')).status, 401)
})

test('after 8 failed attempts per account: 429, even with the right password', async () => {
  const login = 'mk.vezeto'
  for (let i = 0; i < 8; i += 1) {
    const res = await server.client().post('/api/auth/login', { login, password: `rossz-${i}` })
    assert.equal(res.status, 401, `próba ${i + 1}`)
  }
  const blocked = await server.client().post('/api/auth/login', DEMO.author)
  assert.equal(blocked.status, 429)
  assert.deepEqual(blocked.body, { error: 'too_many_attempts' })
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
  // Another account from the same IP can still log in.
  assert.equal((await server.client().post('/api/auth/login', DEMO.reviewer)).status, 200)
})

// The IP limit (30) is shared by the whole file: this test proves it with few attempts (4 + 5 > 8).
test('a successful login resets the account counter', async () => {
  const login = DEMO.director.login
  for (let i = 0; i < 4; i += 1) await server.client().post('/api/auth/login', { login, password: 'rossz' })
  assert.equal((await server.client().post('/api/auth/login', DEMO.director)).status, 200)
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await server.client().post('/api/auth/login', { login, password: 'rossz' })).status, 401)
  }
})
