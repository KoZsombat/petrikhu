import { afterAll, beforeAll, expect, test } from 'bun:test'
import { DEMO, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
let editor: Client
beforeAll(async () => {
  s = await startTestServer()
  admin = await s.login(DEMO.admin)
  await admin.post('/api/users', { username: 'szerkeszto', displayName: 'Szerkesztő', role: 'editor', password: 'SzerkesztoJelszo1' })
  await admin.post('/api/users', { username: 'senki', displayName: 'Senki', role: 'inactive', password: 'SenkiJelszo1234' })
  editor = await s.login({ username: 'szerkeszto', password: 'SzerkesztoJelszo1' })
})
afterAll(() => s.close())

test('without login: 401 everywhere in the admin API', async () => {
  const anon = s.client()
  for (const path of ['/api/posts/dashboard', '/api/pages', '/api/library', '/api/users', '/api/audit', '/api/statistics', '/api/media', '/api/terms']) {
    expect((await anon.get(path)).status).toBe(401)
  }
})

test('an author cannot reach pages, library, users, audit or statistics', async () => {
  const author = await s.login(DEMO.author)
  for (const path of ['/api/pages', '/api/library', '/api/audit', '/api/statistics', '/api/pages/menu/hu']) expect((await author.get(path)).status).toBe(403)
  expect((await author.post('/api/users', { username: 'x', displayName: 'x', role: 'admin', password: 'xxxxxxxxxxxx' })).status).toBe(403)
})

test('an editor has pages, menu, library and media, but no news review and no users', async () => {
  for (const path of ['/api/pages', '/api/library', '/api/pages/menu/en', '/api/media']) expect((await editor.get(path)).status).toBe(200)
  expect((await editor.get('/api/audit')).status).toBe(403)
  expect((await editor.post('/api/posts', { title: 'x', content: { type: 'doc', content: [] }, categoryIds: [] })).status).toBe(403)
})

test('an inactive account can log in but reaches nothing', async () => {
  const nobody = await s.login({ username: 'senki', password: 'SenkiJelszo1234' })
  expect((await nobody.get('/api/auth/me')).body.capabilities).toEqual([])
  expect((await nobody.get('/api/posts?status=draft')).status).toBe(403)
  expect((await nobody.get('/api/pages')).status).toBe(403)
})

test('the user directory gives a non-manager only names', async () => {
  const list = await editor.get('/api/users')
  expect(Object.keys(list.body.users[0]).sort()).toEqual(['displayName', 'id'])
  const full = await admin.get('/api/users')
  expect(full.body.users[0]).toHaveProperty('role')
})

test('account rules: short password 422, duplicate username 409, cannot delete yourself, the last admin keeps the right', async () => {
  expect((await admin.post('/api/users', { username: 'rovid', displayName: 'R', role: 'author', password: 'rovid' })).status).toBe(422)
  expect((await admin.post('/api/users', { username: 'IGAZGATO', displayName: 'D', role: 'author', password: 'HosszuJelszo123' })).status).toBe(409)
  const me = (await admin.get('/api/auth/me')).body.user
  expect((await admin.delete(`/api/users/${me.id}`)).body).toEqual({ error: 'cannot_delete_self' })
  expect((await admin.put(`/api/users/${me.id}`, { username: 'igazgato', displayName: 'Szabó Éva', role: 'reviewer' })).body).toEqual({ error: 'last_manager' })
  const second = await admin.post('/api/users', { username: 'admin2', displayName: 'Második admin', role: 'admin', password: 'AdminJelszo1234' })
  expect((await admin.put(`/api/users/${me.id}`, { username: 'igazgato', displayName: 'Szabó Éva', role: 'admin' })).status).toBe(200)
  expect((await admin.delete(`/api/users/${second.body.user.id}`)).body).toEqual({ ok: true })
})

test('a deleted account keeps its posts; the author shows as null', async () => {
  const temp = await admin.post('/api/users', { username: 'ideiglenes', displayName: 'Ideiglenes', role: 'author', password: 'Ideiglenes12345' })
  const writer = await s.login({ username: 'ideiglenes', password: 'Ideiglenes12345' })
  const post = await writer.post('/api/posts', { title: 'Árva hír', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }, categoryIds: ['hirek'] })
  await admin.delete(`/api/users/${temp.body.user.id}`)
  const kept = await admin.get(`/api/posts/${post.body.post.id}`)
  expect(kept.body.post.authorId).toBeNull()
})

test('modifying calls from another origin are refused; the site’s own origin passes', async () => {
  const foreign = await admin.post('/api/terms', { kind: 'tag', name: 'Idegen' }, { origin: 'https://evil.example' })
  expect(foreign.status).toBe(403)
  expect(foreign.body).toEqual({ error: 'bad_origin' })
  const own = await admin.post('/api/terms', { kind: 'tag', name: 'Saját' }, { origin: s.url })
  expect(own.status).toBe(201)
  const forwarded = await admin.post('/api/terms', { kind: 'tag', name: 'Továbbított' }, { origin: 'http://localhost:4000', 'x-forwarded-host': 'localhost:4000' })
  expect(forwarded.status).toBe(201)
})

test('terms: anyone may list, creating needs terms.create, duplicates 409', async () => {
  const author = await s.login(DEMO.author)
  expect((await author.get('/api/terms')).status).toBe(200)
  expect((await author.post('/api/terms', { kind: 'category', name: 'Új' })).status).toBe(403)
  const reviewer = await s.login(DEMO.reviewer)
  expect((await reviewer.post('/api/terms', { kind: 'category', name: 'Teszt kategória', parentId: 'hirek' })).status).toBe(201)
  expect((await reviewer.post('/api/terms', { kind: 'category', name: 'teszt KATEGÓRIA' })).status).toBe(409)
})
