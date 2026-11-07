/** Who approves (C2) and what can be done with a scheduled post (C3): edit in place, move, unschedule. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { auditLog } from '../../src/db/schema.ts'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let author: Client
let reviewer: Client
beforeAll(async () => {
  s = await startTestServer()
  author = await s.login(DEMO.author)
  reviewer = await s.login(DEMO.reviewer)
})
afterAll(() => s.close())

const body = (title: string, extra: Record<string, unknown> = {}) => ({ title, excerpt: '', content: doc(`${title} szövege`), categoryIds: ['hirek'], ...extra })
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
const actionsOf = async (id: string) => (await s.db.select({ action: auditLog.action, userId: auditLog.userId }).from(auditLog).where(and(eq(auditLog.entityType, 'post'), eq(auditLog.entityId, id)))).map((e) => e.action)

async function scheduled(title: string): Promise<string> {
  const id = (await author.post('/api/posts', body(title, { command: 'submit' }))).body.post.id
  expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: inHours(24) })).body).toEqual({ notice: 'scheduled' })
  return id
}

describe('approving', () => {
  test('a reviewer approves their own post; the audit entry names them', async () => {
    const own = (await reviewer.post('/api/posts', body('Saját jóváhagyás', { command: 'submit' }))).body.post.id
    expect((await reviewer.post(`/api/posts/${own}/decision`, { decision: 'approve' })).body).toEqual({ notice: 'approved' })
    const me = (await reviewer.get('/api/auth/me')).body.user.id
    const [entry] = await s.db.select().from(auditLog).where(and(eq(auditLog.entityId, own), eq(auditLog.action, 'approved')))
    expect(entry.userId).toBe(me)
  })

  test('an author approves nothing, not even their own post; nor schedules or unschedules', async () => {
    const id = (await author.post('/api/posts', body('Szerző nem hagyja jóvá', { command: 'submit' }))).body.post.id
    expect((await author.post(`/api/posts/${id}/decision`, { decision: 'approve' })).status).toBe(403)
    expect((await author.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: inHours(5) })).status).toBe(403)
    expect((await author.post(`/api/posts/${await scheduled('Szerző nem vonja vissza')}/unschedule`)).status).toBe(403)
  })
})

describe('scheduled posts', () => {
  test('a reviewer edits one in place: it stays scheduled with the same time', async () => {
    const id = await scheduled('Elírással időzítve')
    const before = (await reviewer.get(`/api/posts/${id}`)).body.post
    const res = await reviewer.put(`/api/posts/${id}`, await s.versioned(id, body('Elírás nélkül időzítve')))
    expect(res.body).toMatchObject({ notice: 'scheduled_saved', post: { status: 'scheduled', title: 'Elírás nélkül időzítve', scheduledFor: before.scheduledFor } })
    expect(await actionsOf(id)).toContain('scheduled_edited')
    expect((await author.put(`/api/posts/${id}`, await s.versioned(id, body('Szerző nem szerkeszti')))).status).toBe(403)
  })

  test('the publication time can be moved; too close → 422; the sweep uses the new time', async () => {
    const id = await scheduled('Áthelyezett időzítés')
    expect((await reviewer.put(`/api/posts/${id}`, await s.versioned(id, body('Áthelyezett időzítés', { publishAt: new Date(Date.now() + 10_000).toISOString() })))).body).toEqual({ error: 'schedule_invalid' })
    const at = inHours(2)
    const res = await reviewer.put(`/api/posts/${id}`, await s.versioned(id, body('Áthelyezett időzítés', { publishAt: at })))
    expect(res.body).toMatchObject({ notice: 'rescheduled', post: { status: 'scheduled', scheduledFor: at, publishedAt: at } })
    expect(await actionsOf(id)).toContain('rescheduled')
  })

  test('publishAt is ignored for a post that is not scheduled', async () => {
    const id = (await author.post('/api/posts', body('Piszkozat időpont nélkül'))).body.post.id
    const res = await author.put(`/api/posts/${id}`, await s.versioned(id, body('Piszkozat időpont nélkül', { publishAt: inHours(3) })))
    expect(res.body.post).toMatchObject({ status: 'draft', scheduledFor: null })
  })

  test('unschedule: back in review, schedule cleared, not public, audit entry; twice → 400', async () => {
    const id = await scheduled('Visszavont időzítés')
    expect((await reviewer.post(`/api/posts/${id}/unschedule`)).body).toEqual({ notice: 'unscheduled' })
    expect((await reviewer.get(`/api/posts/${id}`)).body.post).toMatchObject({ status: 'in_review', scheduledFor: null, publishedAt: null })
    expect((await s.client().get('/api/public/posts/visszavont-idozites')).status).toBe(404)
    expect(await actionsOf(id)).toContain('unscheduled')
    expect((await reviewer.post(`/api/posts/${id}/unschedule`)).status).toBe(400)
    // It can be decided again.
    expect((await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })).body).toEqual({ notice: 'approved' })
  })
})
