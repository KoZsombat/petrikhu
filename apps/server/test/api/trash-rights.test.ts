/**
 * Who may trash and delete a post, per status and role. A published, scheduled or archived post needs
 * `news.manage`, also once it is in the trash (the second DELETE); drafts and posts in review keep their rules.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ROLE_CAPABILITIES } from '@petrik/shared/roles'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let author: Client
let reviewer: Client
let admin: Client
let editor: Client

beforeAll(async () => {
  s = await startTestServer()
  author = await s.login(DEMO.author)
  reviewer = await s.login(DEMO.reviewer)
  admin = await s.login(DEMO.admin)
  await admin.post('/api/users', { username: 'szerk', displayName: 'Szerkesztő', role: 'editor', password: 'SzerkesztoJelszo1' })
  editor = await s.login({ username: 'szerk', password: 'SzerkesztoJelszo1' })
})
afterAll(() => s.close())

const body = (title: string, command = 'draft') => ({ title, excerpt: '', content: doc(`${title} szövege`), categoryIds: ['hirek'], command })

/** A post of the author in the given status. */
async function postIn(status: 'draft' | 'in_review' | 'published' | 'scheduled' | 'archived'): Promise<string> {
  const res = await author.post('/api/posts', body(`${status} ${crypto.randomUUID().slice(0, 6)}`, status === 'draft' ? 'draft' : 'submit'))
  const id = res.body.post.id
  if (status === 'published' || status === 'archived') await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve' })
  if (status === 'scheduled') await reviewer.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: new Date(Date.now() + 86_400_000).toISOString() })
  if (status === 'archived') await admin.post(`/api/posts/${id}/archive`)
  expect((await admin.get(`/api/posts/${id}`)).body.post.status).toBe(status)
  return id
}

describe('the roles as they are', () => {
  test('the author trashes and deletes only their own draft', async () => {
    const draft = await postIn('draft')
    expect((await author.delete(`/api/posts/${draft}`)).body).toMatchObject({ notice: 'trashed' })
    expect((await author.delete(`/api/posts/${draft}`)).body).toMatchObject({ permanent: true })
    for (const status of ['in_review', 'published', 'scheduled', 'archived'] as const) {
      expect((await author.delete(`/api/posts/${await postIn(status)}`)).status).toBe(403)
    }
  })

  test('a once-published post trashed by a manager cannot be deleted or restored by its author', async () => {
    const id = await postIn('published')
    expect((await reviewer.delete(`/api/posts/${id}`)).body).toMatchObject({ notice: 'trashed' })
    expect((await admin.get(`/api/posts/${id}`)).body.post).toMatchObject({ status: 'trash', trashedFrom: 'published' })
    expect((await author.delete(`/api/posts/${id}`)).status).toBe(403)
    expect((await author.post(`/api/posts/${id}/untrash`)).status).toBe(404)
    expect((await reviewer.delete(`/api/posts/${id}`)).body).toMatchObject({ permanent: true })
  })

  test('the editor (no news rights) touches no post', async () => {
    expect((await editor.delete(`/api/posts/${await postIn('draft')}`)).status).toBe(403)
  })

  test('the admin may do everything', async () => {
    for (const status of ['draft', 'in_review', 'published', 'scheduled', 'archived'] as const) {
      const id = await postIn(status)
      expect((await admin.delete(`/api/posts/${id}`)).status).toBe(200)
      expect((await admin.delete(`/api/posts/${id}`)).body).toMatchObject({ permanent: true })
    }
  })
})

describe('news.review without news.manage', () => {
  let saved: typeof ROLE_CAPABILITIES.reviewer
  beforeAll(() => {
    saved = ROLE_CAPABILITIES.reviewer
    ROLE_CAPABILITIES.reviewer = saved.filter((capability) => capability !== 'news.manage')
  })
  afterAll(() => {
    ROLE_CAPABILITIES.reviewer = saved
  })

  test('drafts and posts in review: trash and delete as before', async () => {
    for (const status of ['draft', 'in_review'] as const) {
      const id = await postIn(status)
      expect((await reviewer.delete(`/api/posts/${id}`)).body).toMatchObject({ notice: 'trashed' })
      expect((await reviewer.delete(`/api/posts/${id}`)).body).toMatchObject({ permanent: true })
    }
  })

  test('published, scheduled, archived: 403, and a trashed one cannot be deleted for good', async () => {
    for (const status of ['published', 'scheduled', 'archived'] as const) {
      const id = await postIn(status)
      expect((await reviewer.delete(`/api/posts/${id}`)).status).toBe(403)
      expect((await admin.delete(`/api/posts/${id}`)).body).toMatchObject({ notice: 'trashed' })
      expect((await reviewer.delete(`/api/posts/${id}`)).status).toBe(403)
      expect((await admin.get(`/api/posts/${id}`)).body.post.status).toBe('trash')
    }
  })
})
