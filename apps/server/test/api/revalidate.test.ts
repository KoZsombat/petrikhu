/** B1: after a change to public output the API asks the site to revalidate the right cache tags; failures never fail the request. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { TAG } from '@petrik/shared/cache-tags'
import { sweepScheduledPosts } from '../../src/routes/posts.ts'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

/** A stand-in for the site's POST /revalidate that records what it was told. */
const calls: { secret: string | null; tags: string[] }[] = []
const site = Bun.serve({
  port: 0,
  async fetch(req) {
    calls.push({ secret: req.headers.get('x-revalidate-secret'), tags: ((await req.json()) as { tags: string[] }).tags })
    return Response.json({ ok: true })
  },
})

let s: TestServer
let admin: Client
let author: Client
beforeAll(async () => {
  s = await startTestServer({ content: true, config: { siteUrl: `http://127.0.0.1:${site.port}`, revalidateSecret: 'titkos-kozos-kulcs' } })
  admin = await s.login(DEMO.admin)
  author = await s.login(DEMO.author)
})
afterAll(async () => {
  await s.close()
  await site.stop(true)
})

/** The tags sent while running `action`. */
async function tagsOf(action: () => Promise<unknown>): Promise<string[]> {
  calls.length = 0
  await action()
  expect(calls.every((call) => call.secret === 'titkos-kozos-kulcs')).toBe(true)
  return calls.flatMap((call) => call.tags)
}

const body = (title: string, extra: Record<string, unknown> = {}) => ({ title, excerpt: '', content: doc('x'), categoryIds: ['hirek'], ...extra })

describe('what is revalidated', () => {
  test('a published page’s content edit: only that page; a renamed one: the lists and both addresses too', async () => {
    const page = (await admin.get('/api/pages?locale=hu')).body.pages.find((p: { slug: string }) => p.slug === 'bemutatkozas')
    const full = (await admin.get(`/api/pages/${page.id}`)).body.page
    const save = async (slug: string) => admin.put(`/api/pages/${page.id}`, await s.versioned(page.id, { slug, title: full.title, description: full.description, status: 'published', blocks: full.blocks }))
    expect(await tagsOf(() => save('bemutatkozas'))).toEqual([TAG.page('hu', 'bemutatkozas')])
    const renamed = await tagsOf(() => save('rolunk'))
    expect(renamed).toEqual(expect.arrayContaining([TAG.page('hu', 'bemutatkozas'), TAG.page('hu', 'rolunk'), TAG.pages, TAG.site, TAG.redirects]))
  })

  test('a draft page: nothing', async () => {
    expect(await tagsOf(() => admin.post('/api/pages', { slug: 'csak-piszkozat', title: 'x', status: 'draft', blocks: [] }))).toEqual([])
  })

  test('posts: approval, edit of a published post, archive, trash; not a draft save', async () => {
    const id = (await author.post('/api/posts', body('Gyorsítótár hír', { command: 'submit' }))).body.post.id
    expect(await tagsOf(() => admin.post(`/api/posts/${id}/decision`, { decision: 'approve' }))).toEqual(expect.arrayContaining([TAG.post('gyorsitotar-hir'), TAG.posts, TAG.sitemap]))
    expect(await tagsOf(async () => admin.put(`/api/posts/${id}`, await s.versioned(id, body('Gyorsítótár hír, javítva'))))).toContain(TAG.post('gyorsitotar-hir'))
    expect(await tagsOf(() => admin.post(`/api/posts/${id}/archive`))).toContain(TAG.posts)
    expect(await tagsOf(() => admin.post(`/api/posts/${id}/unarchive`))).toContain(TAG.posts)
    expect(await tagsOf(() => admin.delete(`/api/posts/${id}`))).toContain(TAG.post('gyorsitotar-hir'))
    const draft = (await author.post('/api/posts', body('Piszkozat marad'))).body.post.id
    expect(await tagsOf(async () => author.put(`/api/posts/${draft}`, await s.versioned(draft, body('Piszkozat marad 2'))))).toEqual([])
  })

  test('the scheduled-post sweep, menu, library, media delete', async () => {
    const id = (await author.post('/api/posts', body('Időzített gyorsítótár', { command: 'submit' }))).body.post.id
    await admin.post(`/api/posts/${id}/decision`, { decision: 'approve', publishAt: new Date(Date.now() + 3_600_000).toISOString() })
    expect(await tagsOf(() => sweepScheduledPosts(s.db, new Date(Date.now() + 7_200_000), s.config))).toContain(TAG.post('idozitett-gyorsitotar'))
    const menu = (await admin.get('/api/pages/menu/hu')).body
    expect(await tagsOf(() => admin.put('/api/pages/menu/hu', { menu: menu.menu, version: menu.version }))).toEqual([TAG.site])
    const library = (await admin.get('/api/library')).body
    expect(await tagsOf(() => admin.put('/api/library', { library: library.library, version: library.version }))).toEqual([TAG.site])
    const form = new FormData()
    form.append('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'torlendo.pdf')
    const file = (await admin.post('/api/library/file', form)).body
    expect(await tagsOf(() => admin.delete(`/api/media/${file.id}`))).toEqual([TAG.all])
  })
})

test('an unreachable site never fails the API request', async () => {
  const other = await startTestServer({ config: { siteUrl: 'http://127.0.0.1:9', revalidateSecret: 'x' } })
  try {
    const client = await other.login(DEMO.admin)
    const menu = (await client.get('/api/pages/menu/hu')).body
    expect((await client.put('/api/pages/menu/hu', { menu: menu.menu, version: menu.version })).status).toBe(200)
  } finally {
    await other.close()
  }
})
