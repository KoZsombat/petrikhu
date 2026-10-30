// 6. fázis: a hírek is lomtárba kerülnek (mint az oldalak), és a napló az oldal / menü / tár / fiók eseményeit is rögzíti.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'
import type { AuditEntry, Post } from '../../shared/pnw/types.ts'

let server: TestServer
let author: Client
let reviewer: Client
let categoryId: string

before(async () => {
  server = await startTestServer()
  author = await server.login(DEMO.author)
  reviewer = await server.login(DEMO.reviewer)
  categoryId = (await server.sql<{ id: string }>("SELECT id FROM terms WHERE kind = 'category' LIMIT 1"))[0].id
})
after(() => server.close())

let n = 0
async function draft(client: Client, command: 'draft' | 'submit' = 'draft'): Promise<string> {
  n += 1
  const res = await client.post('/api/posts', {
    title: `Lomtár teszt ${n}`,
    content: JSON.stringify([{ id: 'b', type: 'paragraph', runs: [{ text: 'Szöveg' }] }]),
    categoryIds: [categoryId],
    command,
  })
  assert.equal(res.status, 200, res.text)
  return (res.body as { post: Post }).post.id
}

const statusOf = async (id: string) => (await server.sql<{ status: string }>('SELECT status FROM posts WHERE id = $1', [id]))[0]?.status
const auditOf = async (): Promise<AuditEntry[]> => ((await reviewer.get('/api/audit?limit=200')).body as { entries: AuditEntry[] }).entries

test('első törlés: lomtár, nem végleges; a vezérlőpult lomtárában látszik', async () => {
  const id = await draft(author)
  const res = await author.delete(`/api/posts/${id}`)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { notice: 'trashed', permanent: false })
  assert.equal(await statusOf(id), 'trash')
  const dashboard = (await author.get('/api/posts/dashboard')).body as { posts: Post[]; trash: Post[] }
  assert.ok(!dashboard.posts.some((p) => p.id === id))
  assert.ok(dashboard.trash.some((p) => p.id === id))
})

test('visszaállítás a lomtárból piszkozatként', async () => {
  const id = await draft(author)
  await author.delete(`/api/posts/${id}`)
  const res = await author.post(`/api/posts/${id}/untrash`)
  assert.equal(res.status, 200)
  assert.equal(await statusOf(id), 'draft')
  // Nem lomtárban lévőre 404.
  assert.equal((await author.post(`/api/posts/${id}/untrash`)).status, 404)
})

test('második törlés: végleges, a napló a címmel megmarad', async () => {
  const id = await draft(author)
  await author.delete(`/api/posts/${id}`)
  const res = await author.delete(`/api/posts/${id}`)
  assert.deepEqual(res.body, { notice: 'deleted', permanent: true })
  assert.equal(await statusOf(id), undefined)
  const deleted = (await auditOf()).find((e) => e.action === 'deleted' && e.subject === `Lomtár teszt ${n}`)
  assert.ok(deleted, 'a végleges törlés naplóbejegyzése')
  assert.equal(deleted.postId, '')
  // A korábbi bejegyzései is megmaradtak (post_id NULL).
  const rows = await server.sql<{ n: number }>("SELECT COUNT(*)::int AS n FROM audit_log WHERE entity_id = $1", [id])
  assert.ok(rows[0].n >= 3)
})

test('jogosultság: más szerző nem törölhet / állíthat vissza, beküldött hírt a szerző nem törölhet', async () => {
  const id = await draft(author)
  const create = await reviewer.post('/api/users', { username: 'masik.szerzo', displayName: 'Másik', password: 'hosszu-jelszo-1', permissions: ['pnw_submit_news'] })
  assert.equal(create.status, 200)
  const other = await server.login({ login: 'masik.szerzo', password: 'hosszu-jelszo-1' })
  assert.equal((await other.delete(`/api/posts/${id}`)).status, 403)
  await author.delete(`/api/posts/${id}`)
  assert.equal((await other.post(`/api/posts/${id}/untrash`)).status, 404)
  // A jóváhagyó bárkiét visszaállíthatja.
  assert.equal((await reviewer.post(`/api/posts/${id}/untrash`)).status, 200)
  const pending = await draft(author, 'submit')
  assert.equal((await author.delete(`/api/posts/${pending}`)).status, 403)
})

test('a lomtárban lévő hír nem nyilvános', async () => {
  const id = await draft(author, 'submit')
  await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve', note: '' })
  const slug = (await server.sql<{ slug: string }>('SELECT slug FROM posts WHERE id = $1', [id]))[0].slug
  assert.equal((await server.client().get(`/api/public/posts/${slug}`)).status, 200)
  await reviewer.delete(`/api/posts/${id}`)
  assert.equal((await server.client().get(`/api/public/posts/${slug}`)).status, 404)
})

test('napló: oldal létrehozása, módosítása, kukázása, visszaállítása, törlése', async () => {
  const blocks = [{ component: 'PageTitle', values: { title: 'X' } }]
  const created = await reviewer.post('/api/pages', { title: 'Naplózott oldal', slug: 'naplozott', blocks, status: 'draft' })
  const id = (created.body as { page: { id: string } }).page.id
  await reviewer.put(`/api/pages/${id}`, { title: 'Naplózott oldal', blocks, status: 'publish' })
  await reviewer.delete(`/api/pages/${id}`)
  await reviewer.post(`/api/pages/${id}/restore`)
  await reviewer.delete(`/api/pages/${id}`)
  await reviewer.delete(`/api/pages/${id}`)
  const pageEntries = (await auditOf()).filter((e) => e.entityType === 'page' && e.entityId === id).reverse()
  assert.deepEqual(pageEntries.map((e) => e.action), ['page_created', 'page_updated', 'page_trashed', 'page_restored', 'page_trashed', 'page_deleted'])
  assert.ok(pageEntries.every((e) => e.subject === 'Naplózott oldal' && e.userId))
  assert.equal(pageEntries[1].note, 'draft → publish')
})

test('napló: menü és Dokumentumtár módosítása és visszaállítása', async () => {
  await reviewer.put('/api/pages/menu', { menu: [{ label: 'Kezdőlap', href: '/' }] })
  await reviewer.delete('/api/pages/menu')
  await reviewer.put('/api/pages/library', { library: { categories: [{ slug: 'a', title: 'A', docs: [{ slug: 'd', title: 'D', file: '/uploads/d.pdf' }] }] } })
  await reviewer.delete('/api/pages/library')
  const actions = (await auditOf()).filter((e) => e.entityType === 'menu' || e.entityType === 'library').map((e) => e.action).reverse()
  assert.deepEqual(actions, ['menu_updated', 'menu_reset', 'library_updated', 'library_reset'])
})

test('napló: fiók létrehozása, jogváltozás tételesen, törlése', async () => {
  const res = await reviewer.post('/api/users', { username: 'naplo.fiok', displayName: 'Napló Fiók', password: 'hosszu-jelszo-2', permissions: ['pnw_submit_news'] })
  const id = (res.body as { user: { id: string } }).user.id
  await reviewer.put(`/api/users/${id}`, { username: 'naplo.fiok', displayName: 'Napló Fiók', permissions: ['pnw_review_news'] })
  await reviewer.delete(`/api/users/${id}`)
  const entries = (await auditOf()).filter((e) => e.entityType === 'user' && e.entityId === id).reverse()
  assert.deepEqual(entries.map((e) => e.action), ['user_created', 'user_updated', 'user_deleted'])
  assert.equal(entries[1].note, '+ pnw_review_news\n- pnw_submit_news')
  assert.ok(entries.every((e) => e.subject === 'naplo.fiok'))
  // A jelszó maga sosem kerül a naplóba.
  assert.ok(!JSON.stringify(entries).includes('hosszu-jelszo'))
})
