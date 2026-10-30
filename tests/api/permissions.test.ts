// Permission boundaries: who may see and do what; account protections.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'

let server: TestServer
let author: Client
let reviewer: Client
let categoryId: string

const PASSWORD = 'JelszoTeszt2026!'
let counter = 0

before(async () => {
  server = await startTestServer()
  author = await server.login(DEMO.author)
  reviewer = await server.login(DEMO.reviewer)
  categoryId = (await server.sql<{ id: string }>("SELECT id FROM terms WHERE kind='category' LIMIT 1"))[0].id
})
after(() => server.close())

type UserBody = { user: { id: string; username: string } }
type UserEntry = { id: string; username?: string; displayName: string; permissions: string[] }

/** Creates a new account with the given rights (on behalf of the reviewer = account manager) and logs it in. */
async function createAccount(permissions: string[]): Promise<{ id: string; client: Client; username: string }> {
  const username = `teszt.${Date.now()}.${counter++}`
  const res = await reviewer.post('/api/users', { username, displayName: 'Teszt Fiók', password: PASSWORD, permissions })
  assert.equal(res.status, 200, res.text)
  const client = await server.login({ login: username, password: PASSWORD })
  return { id: (res.body as UserBody).user.id, client, username }
}

function postBody(command: 'draft' | 'submit' = 'draft') {
  return {
    title: `Jogosultság teszt ${Date.now()} ${counter++}`,
    content: JSON.stringify([{ id: 'b1', type: 'paragraph', runs: [{ text: 'Szöveg.' }] }]),
    excerpt: '',
    categoryIds: [categoryId],
    tagIds: [],
    command,
  }
}

async function authorPost(client: Client, command: 'draft' | 'submit' = 'draft'): Promise<string> {
  const res = await client.post('/api/posts', postBody(command))
  assert.equal(res.status, 200, res.text)
  return (res.body as { post: { id: string } }).post.id
}

async function allUsers(client: Client): Promise<UserEntry[]> {
  return ((await client.get('/api/users')).body as { users: UserEntry[] }).users
}

test('another author cannot reach the first author\'s draft (GET 404, PUT/DELETE 403, not on the dashboard)', async () => {
  const id = await authorPost(author)
  const other = await createAccount(['pnw_submit_news'])

  assert.equal((await other.client.get(`/api/posts/${id}`)).status, 404)
  assert.equal((await other.client.put(`/api/posts/${id}`, postBody())).status, 403)
  assert.equal((await other.client.delete(`/api/posts/${id}`)).status, 403)
  assert.equal((await other.client.get(`/api/posts/${id}/audit`)).status, 404)

  const dash = await other.client.get('/api/posts/dashboard')
  assert.equal(dash.status, 200)
  const posts = (dash.body as { posts: { id: string }[] }).posts
  assert.ok(!posts.some((p) => p.id === id))

  // The original author still sees it.
  assert.equal((await author.get(`/api/posts/${id}`)).status, 200)
})

test('after submission (pending) the author can no longer edit: PUT → 403', async () => {
  const id = await authorPost(author, 'submit')
  const res = await author.put(`/api/posts/${id}`, postBody())
  assert.equal(res.status, 403)
  const del = await author.delete(`/api/posts/${id}`)
  assert.equal(del.status, 403)
})

test('decision on a post that is not pending → 400 not_pending; the author right is not enough for a decision → 403', async () => {
  const draftId = await authorPost(author)
  const res = await reviewer.post(`/api/posts/${draftId}/decision`, { decision: 'approve' })
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: 'not_pending' })

  const pendingId = await authorPost(author, 'submit')
  const denied = await author.post(`/api/posts/${pendingId}/decision`, { decision: 'approve' })
  assert.equal(denied.status, 403)
  const stillPending = await server.sql<{ status: string }>('SELECT status FROM posts WHERE id = $1', [pendingId])
  assert.equal(stillPending[0].status, 'pending')
})

test('without login: dashboard 401, /api/pages and /api/pages/library 403', async () => {
  const anon = server.client()
  assert.equal((await anon.get('/api/posts/dashboard')).status, 401)
  assert.equal((await anon.get('/api/pages')).status, 403)
  assert.equal((await anon.get('/api/pages/library')).status, 403)
})

test('the author (without pnw_manage_pages) cannot reach the pages and the library', async () => {
  assert.equal((await author.get('/api/pages')).status, 403)
  assert.equal((await author.get('/api/pages/library')).status, 403)
})

test('only pnw_manage_library: /api/pages/library 200, /api/pages 403', async () => {
  const lib = await createAccount(['pnw_manage_library'])
  assert.equal((await lib.client.get('/api/pages/library')).status, 200)
  assert.equal((await lib.client.get('/api/pages')).status, 403)
})

test('only pnw_manage_pages: /api/pages 200, /api/pages/library 403', async () => {
  const pages = await createAccount(['pnw_manage_pages'])
  assert.equal((await pages.client.get('/api/pages')).status, 200)
  assert.equal((await pages.client.get('/api/pages/library')).status, 403)
})

test('/api/audit and /api/statistics require pnw_view_audit_log', async () => {
  assert.equal((await author.get('/api/audit')).status, 403)
  assert.equal((await author.get('/api/statistics')).status, 403)
  assert.equal((await server.client().get('/api/audit')).status, 403)

  assert.equal((await reviewer.get('/api/audit')).status, 200)
  assert.equal((await reviewer.get('/api/statistics')).status, 200)

  const viewer = await createAccount(['pnw_view_audit_log'])
  assert.equal((await viewer.client.get('/api/audit')).status, 200)
  assert.equal((await viewer.client.get('/api/statistics')).status, 200)
})

test('GET /api/users gives a non-manager no usernames or permissions', async () => {
  const forAuthor = await allUsers(author)
  assert.ok(forAuthor.length >= 3)
  for (const u of forAuthor) {
    assert.equal(u.username, undefined)
    assert.deepEqual(u.permissions, [])
    assert.ok(u.displayName)
  }

  const forManager = await allUsers(reviewer)
  const mk = forManager.find((u) => u.username === DEMO.author.login)
  assert.ok(mk)
  assert.deepEqual(mk.permissions, ['pnw_submit_news'])

  assert.equal((await server.client().get('/api/users')).status, 401)
})

test('account management is forbidden for non-managers (POST/PUT/DELETE → 403)', async () => {
  const body = { username: 'valaki.uj', displayName: 'Új', password: PASSWORD, permissions: [] }
  assert.equal((await author.post('/api/users', body)).status, 403)
  const users = await allUsers(reviewer)
  const target = users.find((u) => u.username === DEMO.reviewer.login)!
  assert.equal((await author.put(`/api/users/${target.id}`, { ...body, permissions: [] })).status, 403)
  assert.equal((await author.delete(`/api/users/${target.id}`)).status, 403)
})

test('password shorter than 10 characters → 422 password_too_short; duplicate username → 409', async () => {
  const short = await reviewer.post('/api/users', { username: 'rovid.jelszo', displayName: 'R', password: '123456789', permissions: [] })
  assert.equal(short.status, 422)
  assert.deepEqual(short.body, { error: 'password_too_short' })

  const dup = await reviewer.post('/api/users', { username: DEMO.author.login, displayName: 'Másolat', password: PASSWORD, permissions: [] })
  assert.equal(dup.status, 409)
  assert.deepEqual(dup.body, { error: 'username_taken' })

  // Not case-sensitive either.
  const dupCase = await reviewer.post('/api/users', { username: DEMO.author.login.toUpperCase(), displayName: 'Másolat', password: PASSWORD, permissions: [] })
  assert.equal(dupCase.status, 409)

  const missing = await reviewer.post('/api/users', { username: '', displayName: '', password: PASSWORD })
  assert.equal(missing.status, 422)
  assert.deepEqual(missing.body, { error: 'missing_fields' })
})

test('deleting your own account → 400 cannot_delete_self', async () => {
  const me = (await allUsers(reviewer)).find((u) => u.username === DEMO.reviewer.login)!
  const res = await reviewer.delete(`/api/users/${me.id}`)
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: 'cannot_delete_self' })
})

test('the right cannot be taken from the last account manager (last_manager); the other managers can be deleted', async () => {
  const director = await server.login(DEMO.director)
  const users = await allUsers(director)
  const helyettes = users.find((u) => u.username === DEMO.reviewer.login)!
  const igazgato = users.find((u) => u.username === DEMO.director.login)!
  assert.ok(helyettes.permissions.includes('pnw_manage_users'))
  assert.ok(igazgato.permissions.includes('pnw_manage_users'))

  // There are two managers: the right can be taken from one of them.
  const without = (u: UserEntry) => u.permissions.filter((p) => p !== 'pnw_manage_users')
  const first = await director.put(`/api/users/${helyettes.id}`, { username: helyettes.username, displayName: helyettes.displayName, permissions: without(helyettes) })
  assert.equal(first.status, 200, first.text)

  // Now the director is the last one: they cannot remove their own right, and the other account (without the right) does not block deletion.
  const last = await director.put(`/api/users/${igazgato.id}`, { username: igazgato.username, displayName: igazgato.displayName, permissions: without(igazgato) })
  assert.equal(last.status, 400)
  assert.deepEqual(last.body, { error: 'last_manager' })

  // An account that has lost the right can be deleted.
  assert.equal((await director.delete(`/api/users/${helyettes.id}`)).status, 200)
  assert.ok(!(await allUsers(director)).some((u) => u.id === helyettes.id))
})

// The "deleting the last manager" branch (DELETE → last_manager) cannot be reached over HTTP: only a manager may delete,
// and nobody may delete themselves, so there is always another manager besides the target.

test('a deleted account\'s posts and log remain, the author is empty', async () => {
  // The director is the account manager: the last_manager test above takes this right away from the deputy.
  const manager = await server.login(DEMO.director)
  const res = await manager.post('/api/users', { username: 'tavozo', displayName: 'Távozó Tanár', password: PASSWORD, permissions: ['pnw_submit_news'] })
  assert.equal(res.status, 200, res.text)
  const leaver = await server.login({ login: 'tavozo', password: PASSWORD })
  const postId = await authorPost(leaver, 'submit')
  assert.equal((await manager.delete(`/api/users/${(res.body as UserBody).user.id}`)).status, 200)
  const post = (await manager.get(`/api/posts/${postId}`)).body as { post: { authorId: string } }
  assert.equal(post.post.authorId, '')
  const audit = (await manager.get(`/api/posts/${postId}/audit`)).body as { entries: { action: string; userId: string | null }[] }
  assert.deepEqual(audit.entries.map((e) => [e.action, e.userId]), [['submitted', null]])
})
