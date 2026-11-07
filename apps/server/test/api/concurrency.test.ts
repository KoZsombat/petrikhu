/** Optimistic concurrency on saves and status guards on workflow steps: two people at once never both win silently. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { librarySchema } from '@petrik/shared/schemas'
import { auditLog } from '../../src/db/schema.ts'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let author: Client
let reviewer: Client
let admin: Client
beforeAll(async () => {
  s = await startTestServer({ content: true })
  author = await s.login(DEMO.author)
  reviewer = await s.login(DEMO.reviewer)
  admin = await s.login(DEMO.admin)
})
afterAll(() => s.close())

const body = (title: string, extra: Record<string, unknown> = {}) => ({ title, excerpt: '', content: doc(`${title} szövege`), categoryIds: ['hirek'], ...extra })

describe('posts', () => {
  test('a save with the loaded version wins; the second with the same version gets 409 with who and when', async () => {
    const created = (await author.post('/api/posts', body('Közös szerkesztés', { command: 'submit' }))).body.post
    expect(created.version).toBe(1)
    const first = await reviewer.put(`/api/posts/${created.id}`, body('Első mentés', { version: 1 }))
    expect(first.status).toBe(200)
    expect(first.body.post.version).toBe(2)
    const second = await admin.put(`/api/posts/${created.id}`, body('Második mentés', { version: 1 }))
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({ error: 'conflict', savedBy: 'Nagy Péter', version: 2 })
    expect(new Date(second.body.savedAt).getTime()).toBeGreaterThan(0)
    expect((await admin.get(`/api/posts/${created.id}`)).body.post.title).toBe('Első mentés')
    // Overwrite: save again with the version from the conflict.
    const overwrite = await admin.put(`/api/posts/${created.id}`, body('Második mentés', { version: second.body.version }))
    expect(overwrite.body.post).toMatchObject({ title: 'Második mentés', version: 3 })
  })

  test('PUT without a version → 422 version_required', async () => {
    const id = (await author.post('/api/posts', body('Verzió nélkül'))).body.post.id
    expect((await author.put(`/api/posts/${id}`, body('X'))).body).toEqual({ error: 'version_required' })
  })

  test('two reviewers deciding at once: one wins, the other gets 409, one audit entry', async () => {
    const id = (await author.post('/api/posts', body('Kettős döntés', { command: 'submit' }))).body.post.id
    const results = await Promise.all([reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' }), admin.post(`/api/posts/${id}/decision`, { decision: 'approve' })])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses[0]).toBe(200)
    expect([400, 409]).toContain(statuses[1])
    const approvals = await s.db.select().from(auditLog).where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'approved')))
    expect(approvals).toHaveLength(1)
  })

  test('archive, unarchive, untrash, unschedule at once: only one succeeds each', async () => {
    const id = (await author.post('/api/posts', body('Párhuzamos lépések', { command: 'submit' }))).body.post.id
    await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
    const archive = await Promise.all([reviewer.post(`/api/posts/${id}/archive`), admin.post(`/api/posts/${id}/archive`)])
    expect(archive.filter((r) => r.status === 200)).toHaveLength(1)
    const unarchive = await Promise.all([reviewer.post(`/api/posts/${id}/unarchive`), admin.post(`/api/posts/${id}/unarchive`)])
    expect(unarchive.filter((r) => r.status === 200)).toHaveLength(1)
    await admin.delete(`/api/posts/${id}`)
    const untrash = await Promise.all([reviewer.post(`/api/posts/${id}/untrash`), admin.post(`/api/posts/${id}/untrash`)])
    expect(untrash.filter((r) => r.status === 200)).toHaveLength(1)
    const actions = (await s.db.select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.entityId, id))).map((e) => e.action)
    for (const action of ['published_archived', 'archived_restored', 'untrashed']) expect(actions.filter((a) => a === action)).toHaveLength(1)

    const scheduled = (await author.post('/api/posts', body('Párhuzamos visszavonás', { command: 'submit' }))).body.post.id
    await reviewer.post(`/api/posts/${scheduled}/decision`, { decision: 'approve', publishAt: new Date(Date.now() + 86_400_000).toISOString() })
    const unschedule = await Promise.all([reviewer.post(`/api/posts/${scheduled}/unschedule`), admin.post(`/api/posts/${scheduled}/unschedule`)])
    expect(unschedule.filter((r) => r.status === 200)).toHaveLength(1)
  })

  test('a workflow step also moves the version: a stale editor gets 409', async () => {
    const created = (await author.post('/api/posts', body('Elavult szerkesztő', { command: 'submit' }))).body.post
    await reviewer.post(`/api/posts/${created.id}/decision`, { decision: 'reject', note: 'Javítsd' })
    expect((await author.put(`/api/posts/${created.id}`, body('Javítva', { version: created.version }))).status).toBe(409)
  })
})

describe('pages, menu, library', () => {
  test('pages: stale version → 409 conflict', async () => {
    const page = (await admin.get('/api/pages?locale=hu')).body.pages.find((p: { slug: string }) => p.slug === 'elerhetoseg')
    const full = (await admin.get(`/api/pages/${page.id}`)).body.page
    const save = (title: string, version: number) => admin.put(`/api/pages/${page.id}`, { slug: full.slug, title, description: full.description, status: 'published', blocks: full.blocks, version })
    expect((await save('Elérhetőség A', full.version)).status).toBe(200)
    const late = await save('Elérhetőség B', full.version)
    expect(late.status).toBe(409)
    expect(late.body).toMatchObject({ error: 'conflict', savedBy: 'Szabó Éva', version: full.version + 1 })
  })

  test('menu: stale version → 409; a not-yet-stored menu is version 0', async () => {
    const loaded = (await admin.get('/api/pages/menu/en')).body
    const menu = [{ label: 'Home', href: '/en' }]
    expect((await admin.put('/api/pages/menu/en', { menu, version: loaded.version })).status).toBe(200)
    const late = await admin.put('/api/pages/menu/en', { menu, version: loaded.version })
    expect(late.status).toBe(409)
    expect(late.body.error).toBe('conflict')
    expect((await admin.put('/api/pages/menu/en', { menu, version: late.body.version })).status).toBe(200)
  })

  test('the seeded library is valid as it is (regression: the same document in two categories)', async () => {
    const loaded = (await admin.get('/api/library')).body
    expect(librarySchema.safeParse(loaded.library).success).toBe(true)
    const twice = { categories: [{ slug: 'a', title: 'A', docs: [{ slug: 'x', title: 'X' }] }, { slug: 'b', title: 'B', docs: [{ slug: 'x', title: 'X' }] }] }
    expect(librarySchema.safeParse(twice).success).toBe(true)
    expect(librarySchema.safeParse({ categories: [{ slug: 'a', title: 'A', docs: [] }, { slug: 'a', title: 'B', docs: [] }] }).success).toBe(false)
  })

  test('library: stale version → 409', async () => {
    const loaded = (await admin.get('/api/library')).body
    expect((await admin.put('/api/library', { library: loaded.library, version: loaded.version })).status).toBe(200)
    expect((await admin.put('/api/library', { library: loaded.library, version: loaded.version })).status).toBe(409)
  })
})
