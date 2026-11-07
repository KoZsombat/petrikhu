import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { auditLog, documents } from '../../src/db/schema.ts'
import { sweepScheduledPosts } from '../../src/routes/posts.ts'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let author: Client
let reviewer: Client
let admin: Client

beforeAll(async () => {
  s = await startTestServer()
  author = await s.login(DEMO.author)
  reviewer = await s.login(DEMO.reviewer)
  admin = await s.login(DEMO.admin)
})
afterAll(() => s.close())

const body = (title: string, extra: Record<string, unknown> = {}) => ({ title, excerpt: '', content: doc(`${title} szövege`), categoryIds: ['hirek'], ...extra })

async function submitted(title: string): Promise<string> {
  const res = await author.post('/api/posts', body(title, { command: 'submit' }))
  expect(res.status).toBe(201)
  return res.body.post.id
}

describe('drafts and submission', () => {
  test('saving a draft → draft, submitting → in_review; the slug comes from the title and stays', async () => {
    const draft = await author.post('/api/posts', body('Első hír ékezetekkel'))
    expect(draft.body).toMatchObject({ notice: 'draft_saved', post: { status: 'draft', slug: 'elso-hir-ekezetekkel' } })
    const id = draft.body.post.id
    const sent = await author.put(`/api/posts/${id}`, await s.versioned(id, body('Átnevezett cím', { command: 'submit' })))
    expect(sent.body).toMatchObject({ notice: 'submitted', post: { status: 'in_review', slug: 'elso-hir-ekezetekkel' } })
  })

  test('after submission the author can no longer edit: PUT → 403', async () => {
    const id = await submitted('Beküldve')
    expect((await author.put(`/api/posts/${id}`, await s.versioned(id, body('Módosítás')))).status).toBe(403)
  })

  test('missing title or empty content → 422 missing_fields; no category → 422 category_required', async () => {
    expect((await author.post('/api/posts', body(''))).body).toEqual({ error: 'missing_fields' })
    expect((await author.post('/api/posts', { ...body('Cím'), content: { type: 'doc', content: [{ type: 'paragraph' }] } })).body).toEqual({ error: 'missing_fields' })
    expect((await author.post('/api/posts', body('Cím', { categoryIds: [] }))).body).toEqual({ error: 'category_required' })
    expect((await author.post('/api/posts', body('Cím', { categoryIds: ['nincs-ilyen'] }))).body).toEqual({ error: 'category_required' })
  })

  test('unsafe content is refused by the schema (javascript: link)', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    const res = await author.post('/api/posts', { ...body('Rossz link'), content })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('invalid_body')
  })
})

describe('review', () => {
  test('approval → published, appears in the public list and by slug', async () => {
    const id = await submitted('Jóváhagyandó hír')
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })).body).toEqual({ notice: 'approved' })
    const list = await s.client().get('/api/public/posts')
    expect(list.body.posts.map((p: { slug: string }) => p.slug)).toContain('jovahagyando-hir')
    expect((await s.client().get('/api/public/posts/jovahagyando-hir')).status).toBe(200)
  })

  test('rejection without a message → 422 rejection_note_required, the post stays in review', async () => {
    const id = await submitted('Elutasítandó')
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'reject', note: '  ' })).body).toEqual({ error: 'rejection_note_required' })
    expect((await reviewer.get(`/api/posts/${id}`)).body.post.status).toBe('in_review')
  })

  test('rejection with a message → draft with the message; the author sees it, edits, resubmits; the message is cleared', async () => {
    const id = await submitted('Javítandó hír')
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'reject', note: 'Pontosítsd a dátumot.' })).body).toEqual({ notice: 'rejected' })
    const seen = await author.get(`/api/posts/${id}`)
    expect(seen.body.post).toMatchObject({ status: 'draft', reviewNote: 'Pontosítsd a dátumot.' })
    const dash = await author.get('/api/posts/dashboard')
    expect(dash.body.posts.find((p: { id: string }) => p.id === id).reviewNote).toBe('Pontosítsd a dátumot.')
    const again = await author.put(`/api/posts/${id}`, await s.versioned(id, body('Javított hír', { command: 'submit' })))
    expect(again.body.post).toMatchObject({ status: 'in_review', reviewNote: null })
  })

  test('scheduling: too close → 422 schedule_invalid; in the future → scheduled, not public; the sweep publishes it', async () => {
    const id = await submitted('Időzített hír')
    const soon = new Date(Date.now() + 30_000).toISOString()
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: soon })).body).toEqual({ error: 'schedule_invalid' })
    const later = new Date(Date.now() + 3_600_000).toISOString()
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: later })).body).toEqual({ notice: 'scheduled' })
    expect((await s.client().get('/api/public/posts/idozitett-hir')).status).toBe(404)
    expect(await sweepScheduledPosts(s.db)).toBe(0)
    expect(await sweepScheduledPosts(s.db, new Date(Date.now() + 7_200_000))).toBe(1)
    expect((await s.client().get('/api/public/posts/idozitett-hir')).status).toBe(200)
    const actions = (await s.db.select().from(auditLog).where(eq(auditLog.entityId, id))).map((e) => e.action)
    expect(actions).toContain('scheduled_published')
  })

  test('a decision on a post not in review → 400; the author right is not enough → 403', async () => {
    const draft = (await author.post('/api/posts', body('Csak piszkozat'))).body.post.id
    expect((await reviewer.post(`/api/posts/${draft}/decision`, { decision: 'approve' })).status).toBe(400)
    const id = await submitted('Szerző nem dönthet')
    expect((await author.post(`/api/posts/${id}/decision`, { decision: 'approve' })).status).toBe(403)
  })

  test('the reviewer can edit a post in review (reviewer_edited) and it stays in review', async () => {
    const id = await submitted('Szerkesztendő')
    const res = await reviewer.put(`/api/posts/${id}`, await s.versioned(id, body('Szerkesztett cím')))
    expect(res.body).toMatchObject({ notice: 'review_saved', post: { status: 'in_review', title: 'Szerkesztett cím' } })
  })
})

describe('published posts', () => {
  test('archiving → archived, off the public list; unarchiving → published', async () => {
    const id = await submitted('Archiválandó')
    await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
    expect((await author.post(`/api/posts/${id}/archive`)).status).toBe(403)
    expect((await reviewer.post(`/api/posts/${id}/archive`)).body).toEqual({ notice: 'published_archived' })
    expect((await s.client().get('/api/public/posts/archivalando')).status).toBe(404)
    expect((await reviewer.post(`/api/posts/${id}/unarchive`)).body).toEqual({ notice: 'archived_restored' })
    expect((await s.client().get('/api/public/posts/archivalando')).status).toBe(200)
  })

  test('archiving an unpublished post → 404; unarchiving a non-archived one → 404', async () => {
    const id = await submitted('Nem publikus')
    expect((await reviewer.post(`/api/posts/${id}/archive`)).status).toBe(404)
    expect((await reviewer.post(`/api/posts/${id}/unarchive`)).status).toBe(404)
  })

  test('editing a published post needs news.manage and keeps it published', async () => {
    const id = await submitted('Kint lévő')
    await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
    expect((await author.put(`/api/posts/${id}`, await s.versioned(id, body('X')))).status).toBe(403)
    const res = await admin.put(`/api/posts/${id}`, await s.versioned(id, body('Kint lévő, javítva')))
    expect(res.body).toMatchObject({ notice: 'published_updated', post: { status: 'published' } })
  })
})

describe('trash', () => {
  test('first delete: trash; restore: a draft; second delete: gone, the log keeps the title', async () => {
    const id = (await author.post('/api/posts', body('Törlendő'))).body.post.id
    expect((await author.delete(`/api/posts/${id}`)).body).toEqual({ notice: 'trashed', permanent: false })
    expect((await author.get('/api/posts/dashboard')).body.trash.map((p: { id: string }) => p.id)).toContain(id)
    expect((await author.post(`/api/posts/${id}/untrash`)).body).toEqual({ notice: 'untrashed' })
    expect((await author.get(`/api/posts/${id}`)).body.post.status).toBe('draft')
    await author.delete(`/api/posts/${id}`)
    expect((await author.delete(`/api/posts/${id}`)).body).toEqual({ notice: 'deleted', permanent: true })
    expect(await s.db.select().from(documents).where(eq(documents.id, id))).toHaveLength(0)
    const deleted = (await s.db.select().from(auditLog).where(eq(auditLog.entityId, id))).find((e) => e.action === 'deleted')
    expect(deleted?.subject).toBe('Törlendő')
  })

  test('another author cannot trash or restore; the author cannot trash a post in review; a trashed post is not public', async () => {
    const other = await s.login(DEMO.admin)
    await other.post('/api/users', { username: 'masik.szerzo', displayName: 'Másik', role: 'author', password: 'MasikJelszo123' })
    const second = await s.login({ username: 'masik.szerzo', password: 'MasikJelszo123' })
    const id = (await author.post('/api/posts', body('Saját'))).body.post.id
    expect((await second.delete(`/api/posts/${id}`)).status).toBe(403)
    expect((await second.get(`/api/posts/${id}`)).status).toBe(404)
    const inReview = await submitted('Beküldött, nem törölhető')
    expect((await author.delete(`/api/posts/${inReview}`)).status).toBe(403)
    const pub = await submitted('Publikus majd lomtár')
    await reviewer.post(`/api/posts/${pub}/decision`, { decision: 'approve' })
    await reviewer.delete(`/api/posts/${pub}`)
    expect((await s.client().get('/api/public/posts/publikus-majd-lomtar')).status).toBe(404)
  })
})

test('every step writes an audit entry, visible on the post', async () => {
  const id = await submitted('Naplózott hír')
  await reviewer.post(`/api/posts/${id}/decision`, { decision: 'reject', note: 'Javíts' })
  await author.put(`/api/posts/${id}`, await s.versioned(id, body('Naplózott hír', { command: 'submit' })))
  await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
  const history = await author.get(`/api/posts/${id}/audit`)
  expect(history.body.entries.map((e: { action: string }) => e.action).reverse()).toEqual(['created_draft', 'submitted', 'rejected', 'submitted', 'approved'])
})

test('lists: published posts newest first, 30 per page, searchable case- and accent-insensitively', async () => {
  for (let i = 0; i < 32; i += 1) {
    const res = await admin.post('/api/posts', body(`Tömeges ${i}`, { command: 'submit' }))
    await admin.post(`/api/posts/${res.body.post.id}/decision`, { decision: 'approve' })
  }
  const first = await admin.get('/api/posts?status=published')
  expect(first.body.posts).toHaveLength(30)
  expect(first.body.totalPages).toBeGreaterThan(1)
  const found = await admin.get('/api/posts?status=published&q=TOMEGES%2031')
  expect(found.body.posts.map((p: { title: string }) => p.title)).toEqual(['Tömeges 31'])
  const byText = await admin.get(`/api/posts?status=published&q=${encodeURIComponent('szövege')}`)
  expect(byText.body.total).toBeGreaterThan(30)
})

test('dashboards: the reviewer sees the queue, counts and today\'s publications; the author only their own posts', async () => {
  const id = await submitted('Dashboard hír')
  const reviewerView = await reviewer.get('/api/posts/dashboard')
  expect(reviewerView.status).toBe(200)
  expect(reviewerView.body.view).toBe('reviewer')
  expect(reviewerView.body.queue.map((p: { id: string }) => p.id)).toContain(id)
  await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
  const after = await reviewer.get('/api/posts/dashboard')
  expect(after.body.publishedToday).toBeGreaterThan(0)
  const authorView = await author.get('/api/posts/dashboard')
  expect(authorView.body.view).toBe('author')
  expect(authorView.body.posts.every((p: { authorId: string }) => p.authorId === authorView.body.posts[0].authorId)).toBe(true)
})
