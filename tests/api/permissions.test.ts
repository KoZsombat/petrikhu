// Jogosultsági határok: ki mit láthat és csinálhat; fiókvédelmek.
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

/** Új fiókot hoz létre a megadott jogokkal (a reviewer = fiókkezelő nevében), és be is lépteti. */
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

test('másik szerző nem éri el az első szerző vázlatát (GET 404, PUT/DELETE 403, nincs az irányítópulton)', async () => {
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

  // Az eredeti szerző továbbra is látja.
  assert.equal((await author.get(`/api/posts/${id}`)).status, 200)
})

test('beküldés (pending) után a szerző már nem szerkesztheti: PUT → 403', async () => {
  const id = await authorPost(author, 'submit')
  const res = await author.put(`/api/posts/${id}`, postBody())
  assert.equal(res.status, 403)
  const del = await author.delete(`/api/posts/${id}`)
  assert.equal(del.status, 403)
})

test('döntés nem függő hírre → 400 not_pending; szerzői jog nem elég a döntéshez → 403', async () => {
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

test('belépés nélkül: dashboard 401, /api/pages és /api/pages/library 403', async () => {
  const anon = server.client()
  assert.equal((await anon.get('/api/posts/dashboard')).status, 401)
  assert.equal((await anon.get('/api/pages')).status, 403)
  assert.equal((await anon.get('/api/pages/library')).status, 403)
})

test('a szerző (pnw_manage_pages nélkül) nem éri el az oldalakat és a dokumentumtárat', async () => {
  assert.equal((await author.get('/api/pages')).status, 403)
  assert.equal((await author.get('/api/pages/library')).status, 403)
})

test('csak pnw_manage_library: /api/pages/library 200, /api/pages 403', async () => {
  const lib = await createAccount(['pnw_manage_library'])
  assert.equal((await lib.client.get('/api/pages/library')).status, 200)
  assert.equal((await lib.client.get('/api/pages')).status, 403)
})

test('csak pnw_manage_pages: /api/pages 200, /api/pages/library 403', async () => {
  const pages = await createAccount(['pnw_manage_pages'])
  assert.equal((await pages.client.get('/api/pages')).status, 200)
  assert.equal((await pages.client.get('/api/pages/library')).status, 403)
})

test('/api/audit és /api/statistics pnw_view_audit_log-ot kér', async () => {
  assert.equal((await author.get('/api/audit')).status, 403)
  assert.equal((await author.get('/api/statistics')).status, 403)
  assert.equal((await server.client().get('/api/audit')).status, 403)

  assert.equal((await reviewer.get('/api/audit')).status, 200)
  assert.equal((await reviewer.get('/api/statistics')).status, 200)

  const viewer = await createAccount(['pnw_view_audit_log'])
  assert.equal((await viewer.client.get('/api/audit')).status, 200)
  assert.equal((await viewer.client.get('/api/statistics')).status, 200)
})

test('a GET /api/users nem-kezelőnek nem ad felhasználónevet és jogosultságot', async () => {
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

test('fiókkezelés nem-kezelőnek tiltott (POST/PUT/DELETE → 403)', async () => {
  const body = { username: 'valaki.uj', displayName: 'Új', password: PASSWORD, permissions: [] }
  assert.equal((await author.post('/api/users', body)).status, 403)
  const users = await allUsers(reviewer)
  const target = users.find((u) => u.username === DEMO.reviewer.login)!
  assert.equal((await author.put(`/api/users/${target.id}`, { ...body, permissions: [] })).status, 403)
  assert.equal((await author.delete(`/api/users/${target.id}`)).status, 403)
})

test('jelszó 10 karakternél rövidebb → 422 password_too_short; ismétlődő felhasználónév → 409', async () => {
  const short = await reviewer.post('/api/users', { username: 'rovid.jelszo', displayName: 'R', password: '123456789', permissions: [] })
  assert.equal(short.status, 422)
  assert.deepEqual(short.body, { error: 'password_too_short' })

  const dup = await reviewer.post('/api/users', { username: DEMO.author.login, displayName: 'Másolat', password: PASSWORD, permissions: [] })
  assert.equal(dup.status, 409)
  assert.deepEqual(dup.body, { error: 'username_taken' })

  // Kis-nagybetűre sem érzékeny.
  const dupCase = await reviewer.post('/api/users', { username: DEMO.author.login.toUpperCase(), displayName: 'Másolat', password: PASSWORD, permissions: [] })
  assert.equal(dupCase.status, 409)

  const missing = await reviewer.post('/api/users', { username: '', displayName: '', password: PASSWORD })
  assert.equal(missing.status, 422)
  assert.deepEqual(missing.body, { error: 'missing_fields' })
})

test('saját fiók törlése → 400 cannot_delete_self', async () => {
  const me = (await allUsers(reviewer)).find((u) => u.username === DEMO.reviewer.login)!
  const res = await reviewer.delete(`/api/users/${me.id}`)
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: 'cannot_delete_self' })
})

test('az utolsó fiókkezelőtől nem vehető el a jog (last_manager); a többi kezelő törölhető', async () => {
  const director = await server.login(DEMO.director)
  const users = await allUsers(director)
  const helyettes = users.find((u) => u.username === DEMO.reviewer.login)!
  const igazgato = users.find((u) => u.username === DEMO.director.login)!
  assert.ok(helyettes.permissions.includes('pnw_manage_users'))
  assert.ok(igazgato.permissions.includes('pnw_manage_users'))

  // Két kezelő van: az egyiktől elvehető a jog.
  const without = (u: UserEntry) => u.permissions.filter((p) => p !== 'pnw_manage_users')
  const first = await director.put(`/api/users/${helyettes.id}`, { username: helyettes.username, displayName: helyettes.displayName, permissions: without(helyettes) })
  assert.equal(first.status, 200, first.text)

  // Most az igazgató az utolsó: a saját jogát nem veheti el, és a másik fiók (jog nélkül) nem blokkolja a törlést.
  const last = await director.put(`/api/users/${igazgato.id}`, { username: igazgato.username, displayName: igazgato.displayName, permissions: without(igazgato) })
  assert.equal(last.status, 400)
  assert.deepEqual(last.body, { error: 'last_manager' })

  // A jog nélkülivé vált fiók törölhető.
  assert.equal((await director.delete(`/api/users/${helyettes.id}`)).status, 200)
  assert.ok(!(await allUsers(director)).some((u) => u.id === helyettes.id))
})

// Az "utolsó kezelő törlése" ág (DELETE → last_manager) HTTP-n át nem érhető el: a törlést csak kezelő
// végezheti, saját magát nem törölheti, tehát a célponton kívül mindig van másik kezelő.
