/** The must-change-password flag: who gets it, what such an account can reach, how it is cleared. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { users } from '../../src/db/schema.ts'
import { createUser, PasswordRuleError, setPassword } from '../../src/lib/users.ts'
import { seedUsers } from '../../src/lib/seed.ts'
import { createDb } from '../../src/db/client.ts'
import postgres from 'postgres'
import { DEMO, TEMPLATE_DB, TEST_DATABASE_URL, dbUrl, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
beforeAll(async () => {
  s = await startTestServer({ keepPasswordChange: true })
  admin = await s.login(DEMO.admin)
})
afterAll(() => s.close())

const flagOf = async (username: string) => (await s.db.select({ flag: users.mustChangePassword }).from(users).where(eq(users.username, username)))[0].flag

describe('an account created by an admin', () => {
  test('logs in with the flag set and reaches only session, logout, own password change and the public API', async () => {
    expect((await admin.post('/api/users', { username: 'uj.kolléga'.replace('é', 'e'), displayName: 'Új Kolléga', role: 'reviewer', password: 'KezdoJelszo123' })).status).toBe(201)
    const login = await s.client().post('/api/auth/login', { username: 'uj.kollega', password: 'KezdoJelszo123' })
    expect(login.body.user.mustChangePassword).toBe(true)
    const colleague = await s.login({ username: 'uj.kollega', password: 'KezdoJelszo123' })
    expect((await colleague.get('/api/auth/me')).body.user.mustChangePassword).toBe(true)
    for (const path of ['/api/posts/dashboard', '/api/users', '/api/terms', '/api/audit']) {
      const res = await colleague.get(path)
      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: 'password_change_required' })
    }
    expect((await colleague.post('/api/terms', { kind: 'tag', name: 'Tilos' })).body).toEqual({ error: 'password_change_required' })
    expect((await colleague.get('/api/public/posts')).status).toBe(200)
  })

  test('the same password again is refused; a new one clears the flag and opens everything', async () => {
    const colleague = await s.login({ username: 'uj.kollega', password: 'KezdoJelszo123' })
    expect((await colleague.put('/api/auth/password', { currentPassword: 'KezdoJelszo123', newPassword: 'KezdoJelszo123' })).body).toEqual({ error: 'same_password' })
    expect((await colleague.put('/api/auth/password', { currentPassword: 'KezdoJelszo123', newPassword: 'SajatJelszo4567' })).status).toBe(200)
    expect(await flagOf('uj.kollega')).toBe(false)
    expect((await colleague.get('/api/posts/dashboard')).status).toBe(200)
    expect((await colleague.post('/api/auth/logout')).status).toBe(200)
  })
})

describe('an admin setting a password', () => {
  test('someone else’s: the flag is set again; one’s own: not', async () => {
    const [row] = await s.db.select().from(users).where(eq(users.username, 'uj.kollega'))
    expect((await admin.put(`/api/users/${row.id}`, { username: 'uj.kollega', displayName: 'Új Kolléga', role: 'reviewer', password: 'AdminAdtaJelszo1' })).status).toBe(200)
    expect(await flagOf('uj.kollega')).toBe(true)
    const me = (await admin.get('/api/auth/me')).body.user
    expect((await admin.put(`/api/users/${me.id}`, { username: 'igazgato', displayName: 'Szabó Éva', role: 'admin', password: 'IgazgatoUjJelszo1' })).status).toBe(200)
    expect(await flagOf('igazgato')).toBe(false)
  })
})

describe('the password rule on every path', () => {
  test('createUser and setPassword refuse a short password', async () => {
    expect(createUser(s.db, { username: 'rovid.jelszo', displayName: 'R', role: 'author', password: 'rovid' })).rejects.toBeInstanceOf(PasswordRuleError)
    const [row] = await s.db.select().from(users).where(eq(users.username, 'uj.kollega'))
    expect(setPassword(s.db, row.id, 'x'.repeat(9), { mustChange: false })).rejects.toBeInstanceOf(PasswordRuleError)
    expect(setPassword(s.db, row.id, 'x'.repeat(201), { mustChange: false })).rejects.toBeInstanceOf(PasswordRuleError)
  })
})

describe('seeding', () => {
  const name = `seed_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const pg = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
  afterAll(async () => {
    await pg.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await pg.end()
  })

  test('production: one admin with the seed password and the flag, no demo accounts', async () => {
    await pg.unsafe(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`)
    const { db, sql } = createDb(dbUrl(name))
    await expect(seedUsers(db, 'rovid', { production: true })).rejects.toBeInstanceOf(PasswordRuleError)
    await seedUsers(db, 'HosszuKezdoJelszo1', { production: true, adminUsername: 'rendszergazda' })
    const rows = await db.select({ username: users.username, role: users.role, flag: users.mustChangePassword }).from(users)
    expect(rows).toEqual([{ username: 'rendszergazda', role: 'admin', flag: true }])
    await sql.end()
  })
})
