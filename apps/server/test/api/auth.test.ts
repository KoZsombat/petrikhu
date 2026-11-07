import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { accounts, sessions, users } from '../../src/db/schema.ts'
import { DEMO, TEST_IP_HEADER, startTestServer } from '../helpers.ts'
import type { TestServer } from '../helpers.ts'

let s: TestServer
beforeAll(async () => {
  s = await startTestServer()
})
afterAll(() => s.close())

describe('login', () => {
  test('success: an httpOnly, SameSite=Lax session cookie and the user with capabilities', async () => {
    const c = s.client()
    const res = await c.post('/api/auth/login', DEMO.author)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ username: 'mk.vezeto', role: 'author' })
    expect(res.body.capabilities).toContain('news.write')
    const cookie = res.headers.getSetCookie().find((h) => h.includes('session_token'))!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect((await c.get('/api/auth/me')).status).toBe(200)
  })

  test('the username is case-insensitive', async () => {
    expect((await s.client().post('/api/auth/login', { username: 'MK.Vezeto', password: DEMO.author.password })).status).toBe(200)
  })

  test('wrong password and unknown account: the same response', async () => {
    const wrong = await s.client().post('/api/auth/login', { username: DEMO.author.username, password: 'nope-nope-nope' })
    const unknown = await s.client().post('/api/auth/login', { username: 'nincs.ilyen', password: 'nope-nope-nope' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.body).toEqual({ error: 'invalid_credentials' })
  })

  test('empty fields', async () => {
    expect((await s.client().post('/api/auth/login', { username: '', password: '' })).body).toEqual({ error: 'empty_fields' })
  })

  test('a new session on every login: the old cookie of the same browser stays separate, logout kills the session', async () => {
    const a = await s.login(DEMO.reviewer)
    const firstToken = [...a.cookies.values()][0]
    const b = await s.login(DEMO.reviewer)
    expect([...b.cookies.values()][0]).not.toBe(firstToken)
    expect((await a.post('/api/auth/logout')).status).toBe(200)
    expect((await a.get('/api/auth/me')).status).toBe(401)
    expect((await b.get('/api/auth/me')).status).toBe(200)
  })

  test('unknown users cost the same hashing work as real ones (no fast path)', async () => {
    const time = async (username: string) => {
      const start = performance.now()
      for (let i = 0; i < 3; i += 1) await s.client().post('/api/auth/login', { username, password: 'wrong-password-123' })
      return performance.now() - start
    }
    // (mk.vezeto: these 6 failures stay under the per-account backoff threshold of the accounts tested below.)
    await time('mk.vezeto')
    const known = await time('mk.vezeto')
    const unknown = await time('senki-sincs')
    // Both run one argon2id computation per attempt: the ratio stays near 1.
    expect(unknown / known).toBeGreaterThan(0.5)
    expect(unknown / known).toBeLessThan(2)
  })
})

describe('lockout keyed on account + IP', () => {
  test('8 failures from one IP lock that IP out of that account, even with the right password', async () => {
    const ip = { [TEST_IP_HEADER]: '10.0.0.1' }
    for (let i = 0; i < 8; i += 1) await s.client(ip).post('/api/auth/login', { username: 'helyettes', password: 'wrong-wrong-1' })
    const locked = await s.client(ip).post('/api/auth/login', DEMO.reviewer)
    expect(locked.status).toBe(429)
    expect(locked.headers.get('retry-after')).toBeTruthy()
  })

  test('a stranger cannot lock someone out: another IP still logs in', async () => {
    const res = await s.client({ [TEST_IP_HEADER]: '10.0.0.2' }).post('/api/auth/login', DEMO.reviewer)
    expect(res.status).toBe(200)
  })

  test('a successful login resets the account+IP counter', async () => {
    const ip = { [TEST_IP_HEADER]: '10.0.0.3' }
    for (let i = 0; i < 7; i += 1) await s.client(ip).post('/api/auth/login', { username: 'igazgato', password: 'wrong-wrong-1' })
    expect((await s.client(ip).post('/api/auth/login', DEMO.admin)).status).toBe(200)
    for (let i = 0; i < 7; i += 1) await s.client(ip).post('/api/auth/login', { username: 'igazgato', password: 'wrong-wrong-1' })
    expect((await s.client(ip).post('/api/auth/login', DEMO.admin)).status).toBe(200)
  })
})

describe('passwords', () => {
  test('changing your own password ends your other sessions, keeps this one', async () => {
    const created = await (await s.login(DEMO.admin)).post('/api/users', { username: 'jelszo.teszt', displayName: 'Jelszó Teszt', role: 'author', password: 'ElsoJelszo123' })
    expect(created.status).toBe(201)
    const here = await s.login({ username: 'jelszo.teszt', password: 'ElsoJelszo123' })
    const elsewhere = await s.login({ username: 'jelszo.teszt', password: 'ElsoJelszo123' })
    expect((await here.put('/api/auth/password', { currentPassword: 'rossz', newPassword: 'MasodikJelszo123' })).body).toEqual({ error: 'wrong_password' })
    expect((await here.put('/api/auth/password', { currentPassword: 'ElsoJelszo123', newPassword: 'rovid' })).status).toBe(422)
    expect((await here.put('/api/auth/password', { currentPassword: 'ElsoJelszo123', newPassword: 'MasodikJelszo123' })).status).toBe(200)
    expect((await here.get('/api/auth/me')).status).toBe(200)
    expect((await elsewhere.get('/api/auth/me')).status).toBe(401)
    expect((await s.client().post('/api/auth/login', { username: 'jelszo.teszt', password: 'ElsoJelszo123' })).status).toBe(401)
    expect((await s.client().post('/api/auth/login', { username: 'jelszo.teszt', password: 'MasodikJelszo123' })).status).toBe(200)
  })

  test('an admin setting someone’s password ends all of that user’s sessions', async () => {
    const admin = await s.login(DEMO.admin)
    const victim = await s.login({ username: 'jelszo.teszt', password: 'MasodikJelszo123' })
    const [row] = await s.db.select().from(users).where(eq(users.username, 'jelszo.teszt'))
    const res = await admin.put(`/api/users/${row.id}`, { username: 'jelszo.teszt', displayName: 'Jelszó Teszt', role: 'author', password: 'HarmadikJelszo123' })
    expect(res.status).toBe(200)
    expect((await victim.get('/api/auth/me')).status).toBe(401)
    expect(await s.db.select().from(sessions).where(eq(sessions.userId, row.id))).toHaveLength(0)
  })

  test('an imported bcrypt hash still logs in and is replaced by argon2id', async () => {
    const [row] = await s.db.select().from(users).where(eq(users.username, 'jelszo.teszt'))
    const bcrypt = await Bun.password.hash('RegiJelszo12345', { algorithm: 'bcrypt', cost: 10 })
    await s.db.update(accounts).set({ password: bcrypt }).where(eq(accounts.userId, row.id))
    expect((await s.client().post('/api/auth/login', { username: 'jelszo.teszt', password: 'RegiJelszo12345' })).status).toBe(200)
    const [account] = await s.db.select().from(accounts).where(eq(accounts.userId, row.id))
    expect(account.password).toStartWith('$argon2id$')
  })
})
