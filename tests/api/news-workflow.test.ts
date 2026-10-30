// A hírek állapotgépe HTTP-n át: vázlat → beküldés → jóváhagyás/elutasítás/időzítés → archiválás → visszaállítás.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'

let server: TestServer
let author: Client
let reviewer: Client
let categoryId: string
let sweepScheduledPosts: () => Promise<void>

before(async () => {
  server = await startTestServer()
  // Ugyanaz a modulpéldány, amit a teszt-segéd töltött be.
  ;({ sweepScheduledPosts } = await import('../../server/app.ts'))
  author = await server.login(DEMO.author)
  reviewer = await server.login(DEMO.reviewer)
  categoryId = (await server.sql<{ id: string }>("SELECT id FROM terms WHERE kind='category' LIMIT 1"))[0].id
})
after(() => server.close())

let counter = 0
const uniqueTitle = (label: string) => `Teszt hír ${label} ${Date.now()} ${counter++}`

/** Érvényes hírtörzs: a content JSON-szövegként megy, a kategóriák tömbként. */
function body(title: string, extra: Record<string, unknown> = {}) {
  return {
    title,
    content: JSON.stringify([{ id: 'b1', type: 'paragraph', runs: [{ text: 'Ez egy teszt bekezdés.' }] }]),
    excerpt: 'Kivonat',
    categoryIds: [categoryId],
    tagIds: [],
    command: 'draft',
    ...extra,
  }
}

type PostBody = { post: { id: string; slug: string; status: string; reviewNote?: string } }

async function createPost(command: 'draft' | 'submit', label = 'x') {
  const res = await author.post('/api/posts', body(uniqueTitle(label), { command }))
  assert.equal(res.status, 200, res.text)
  return (res.body as PostBody).post
}

async function statusOf(id: string): Promise<string> {
  const rows = await server.sql<{ status: string }>('SELECT status FROM posts WHERE id = $1', [id])
  return rows[0]?.status
}

async function auditActions(client: Client, id: string): Promise<string[]> {
  const res = await client.get(`/api/posts/${id}/audit`)
  assert.equal(res.status, 200, res.text)
  return (res.body as { entries: { action: string }[] }).entries.map((e) => e.action)
}

async function publicSlugs(): Promise<string[]> {
  const res = await author.get('/api/public/posts?limit=1000')
  return (res.body as { posts: { slug: string }[] }).posts.map((p) => p.slug)
}

test('vázlat mentése → draft, beküldés → pending', async () => {
  const post = await createPost('draft')
  assert.equal(post.status, 'draft')

  const res = await author.put(`/api/posts/${post.id}`, body('Beküldött hír ' + counter++, { command: 'submit' }))
  assert.equal(res.status, 200, res.text)
  assert.equal((res.body as { notice: string }).notice, 'submitted')
  assert.equal(await statusOf(post.id), 'pending')
})

test('jóváhagyás → publish, megjelenik a nyilvános listában és slug szerint', async () => {
  const post = await createPost('submit')
  assert.equal(post.status, 'pending')
  assert.ok(!(await publicSlugs()).includes(post.slug))

  const res = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve' })
  assert.equal(res.status, 200, res.text)
  assert.equal(await statusOf(post.id), 'publish')

  assert.ok((await publicSlugs()).includes(post.slug))
  const single = await server.client().get(`/api/public/posts/${post.slug}`)
  assert.equal(single.status, 200)
  assert.equal((single.body as PostBody).post.id, post.id)
})

test('elutasítás indoklás nélkül → 422 rejection_note_required, a hír pending marad', async () => {
  const post = await createPost('submit')
  const res = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'reject' })
  assert.equal(res.status, 422)
  assert.deepEqual(res.body, { error: 'rejection_note_required' })
  assert.equal(await statusOf(post.id), 'pending')
})

test('elutasítás indoklással → revision, a szerző szerkesztheti és újra beküldheti', async () => {
  const post = await createPost('submit')
  const res = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'reject', note: 'Javítsd a címet.' })
  assert.equal(res.status, 200, res.text)
  assert.equal(await statusOf(post.id), 'pnw_revision')

  const seen = await author.get(`/api/posts/${post.id}`)
  assert.equal(seen.status, 200)
  assert.equal((seen.body as PostBody).post.reviewNote, 'Javítsd a címet.')

  const edited = await author.put(`/api/posts/${post.id}`, body('Javított cím ' + counter++, { command: 'draft' }))
  assert.equal(edited.status, 200, edited.text)

  const resubmit = await author.put(`/api/posts/${post.id}`, body('Javított cím ' + counter++, { command: 'submit' }))
  assert.equal(resubmit.status, 200, resubmit.text)
  assert.equal(await statusOf(post.id), 'pending')
  const after_ = await author.get(`/api/posts/${post.id}`)
  assert.equal((after_.body as PostBody).post.reviewNote, undefined)
})

test('időzítés: túl közeli időpont → 422 schedule_invalid', async () => {
  const post = await createPost('submit')
  const soon = new Date(Date.now() + 30_000).toISOString()
  const res = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', publishMode: 'schedule', publishAt: soon })
  assert.equal(res.status, 422)
  assert.deepEqual(res.body, { error: 'schedule_invalid' })
  assert.equal(await statusOf(post.id), 'pending')

  const bad = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', publishMode: 'schedule', publishAt: 'nem dátum' })
  assert.equal(bad.status, 422)
})

test('időzítés: jövőbeli időpont → future, nem nyilvános; a söprés után publish + scheduled_published', async () => {
  const post = await createPost('submit')
  const later = new Date(Date.now() + 3_600_000).toISOString()
  const res = await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', publishMode: 'schedule', publishAt: later })
  assert.equal(res.status, 200, res.text)
  assert.equal(await statusOf(post.id), 'future')
  assert.ok(!(await publicSlugs()).includes(post.slug))
  assert.equal((await server.client().get(`/api/public/posts/${post.slug}`)).status, 404)

  // Még nem járt le: a söprés nem nyúl hozzá.
  await sweepScheduledPosts()
  assert.equal(await statusOf(post.id), 'future')

  await server.sql('UPDATE posts SET date = $1 WHERE id = $2', [new Date(Date.now() - 60_000).toISOString(), post.id])
  await sweepScheduledPosts()
  assert.equal(await statusOf(post.id), 'publish')
  assert.ok((await publicSlugs()).includes(post.slug))

  const actions = await auditActions(reviewer, post.id)
  assert.ok(actions.includes('scheduled'))
  assert.ok(actions.includes('scheduled_published'))
})

test('archiválás → archived, eltűnik a nyilvános listából; visszaállítás → publish', async () => {
  const post = await createPost('submit')
  await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve' })
  assert.ok((await publicSlugs()).includes(post.slug))

  const archived = await reviewer.post(`/api/posts/${post.id}/archive`)
  assert.equal(archived.status, 200, archived.text)
  assert.equal(await statusOf(post.id), 'pnw_archived')
  assert.ok(!(await publicSlugs()).includes(post.slug))

  const restored = await reviewer.post(`/api/posts/${post.id}/restore`)
  assert.equal(restored.status, 200, restored.text)
  assert.equal(await statusOf(post.id), 'publish')
  assert.ok((await publicSlugs()).includes(post.slug))

  const actions = await auditActions(reviewer, post.id)
  assert.ok(actions.includes('published_archived'))
  assert.ok(actions.includes('archived_restored'))
})

test('nem megjelent hír archiválása → 404; nem archivált hír visszaállítása → 404', async () => {
  const post = await createPost('draft')
  const res = await reviewer.post(`/api/posts/${post.id}/archive`)
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, { error: 'not_found' })
  const restore = await reviewer.post(`/api/posts/${post.id}/restore`)
  assert.equal(restore.status, 404)
})

test('hiányzó mezők → 422 missing_fields', async () => {
  const noTitle = await author.post('/api/posts', body('', { command: 'submit' }))
  assert.equal(noTitle.status, 422)
  assert.deepEqual(noTitle.body, { error: 'missing_fields' })

  const emptyText = await author.post('/api/posts', body('Üres szöveg', { content: JSON.stringify([{ id: 'b1', type: 'paragraph', runs: [{ text: '   ' }] }]) }))
  assert.equal(emptyText.status, 422)
  assert.deepEqual(emptyText.body, { error: 'missing_fields' })

  const noContent = await author.post('/api/posts', body('Nincs tartalom', { content: undefined }))
  assert.equal(noContent.status, 422)
  assert.deepEqual(noContent.body, { error: 'missing_fields' })
})

test('kategória nélkül → 422 category_required', async () => {
  const none = await author.post('/api/posts', body(uniqueTitle('kat'), { categoryIds: [] }))
  assert.equal(none.status, 422)
  assert.deepEqual(none.body, { error: 'category_required' })

  const unknown = await author.post('/api/posts', body(uniqueTitle('kat'), { categoryIds: ['nincs-ilyen-kategoria'] }))
  assert.equal(unknown.status, 422)
  assert.deepEqual(unknown.body, { error: 'category_required' })
})

test('minden lépésről audit-bejegyzés készül', async () => {
  const post = await createPost('draft')
  await author.put(`/api/posts/${post.id}`, body('Auditált ' + counter++, { command: 'draft' }))
  await author.put(`/api/posts/${post.id}`, body('Auditált ' + counter++, { command: 'submit' }))
  await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'reject', note: 'Kérlek javítsd.' })
  await author.put(`/api/posts/${post.id}`, body('Auditált ' + counter++, { command: 'submit' }))
  await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve' })
  await reviewer.post(`/api/posts/${post.id}/archive`)

  const actions = await auditActions(reviewer, post.id)
  for (const expected of ['created_draft', 'updated_draft', 'submitted', 'rejected', 'approved', 'published_archived']) {
    assert.ok(actions.includes(expected), `hiányzik: ${expected} (volt: ${actions.join(', ')})`)
  }

  // A teljes napló is látja (audit-jogú fiók).
  const log = await reviewer.get('/api/audit?limit=200')
  assert.equal(log.status, 200)
  assert.ok((log.body as { entries: { action: string }[] }).entries.some((e) => e.action === 'rejected'))
})

test('a szerző törölheti a saját vázlatát', async () => {
  const post = await createPost('draft')
  const res = await author.delete(`/api/posts/${post.id}`)
  assert.equal(res.status, 200, res.text)

  const after_ = await author.get(`/api/posts/${post.id}`)
  const gone = after_.status === 404
  const trashed = after_.status === 200 && (after_.body as PostBody).post.status === 'trash'
  assert.ok(gone || trashed, `váratlan válasz: ${after_.status} ${after_.text}`)
})
