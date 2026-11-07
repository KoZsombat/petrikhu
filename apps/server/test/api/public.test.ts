import { afterAll, beforeAll, expect, test } from 'bun:test'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { TestServer } from '../helpers.ts'

let s: TestServer
beforeAll(async () => {
  s = await startTestServer({ content: true })
  const author = await s.login(DEMO.author)
  const reviewer = await s.login(DEMO.reviewer)
  for (const [title, category] of [['Esti hír', 'esti-munkarend'], ['Oktatási hír', 'oktatas'], ['Sima hír', 'hirek']]) {
    const created = await author.post('/api/posts', { title, excerpt: `${title} kivonata`, content: doc(`${title} teste`), categoryIds: [category], command: 'submit' })
    // A rejection leaves a review note behind: it must never reach the public API.
    await reviewer.post(`/api/posts/${created.body.post.id}/decision`, { decision: 'reject', note: 'BELSO-MEGJEGYZES' })
    await author.put(`/api/posts/${created.body.post.id}`, await s.versioned(created.body.post.id, { title, excerpt: `${title} kivonata`, content: doc(`${title} teste`), categoryIds: [category], command: 'submit' }))
    await reviewer.post(`/api/posts/${created.body.post.id}/decision`, { decision: 'approve' })
  }
  await author.post('/api/posts', { title: 'Titkos piszkozat', content: doc('x'), categoryIds: ['hirek'] })
})
afterAll(() => s.close())

const POST_SUMMARY_FIELDS = ['categories', 'excerpt', 'image', 'publishedAt', 'slug', 'title']
const POST_FIELDS = [...POST_SUMMARY_FIELDS, 'content', 'featuredImage', 'imagePosition'].sort()
const PAGE_FIELDS = ['alternate', 'blocks', 'description', 'locale', 'slug', 'title']
const INTERNAL = ['reviewNote', 'authorId', 'reviewedById', '"status"', 'searchText', 'updatedById', 'scheduledById', 'BELSO-MEGJEGYZES', 'review_note', 'author_id']

test('public DTOs carry exactly the public fields, never internal ones', async () => {
  const list = await s.client().get('/api/public/posts?limit=50')
  for (const post of list.body.posts) expect(Object.keys(post).sort()).toEqual(POST_SUMMARY_FIELDS)
  const one = await s.client().get('/api/public/posts/esti-hir')
  expect(Object.keys(one.body.post).sort()).toEqual(POST_FIELDS)
  const page = await s.client().get('/api/public/pages/hu/elerhetoseg')
  expect(Object.keys(page.body.page).sort()).toEqual(PAGE_FIELDS)
  for (const res of [list, one, page, await s.client().get('/api/public/site/hu')]) {
    for (const word of INTERNAL) expect(res.text).not.toContain(word)
  }
})

test('the public list: only published posts, newest first, with categories; drafts are invisible', async () => {
  const list = await s.client().get('/api/public/posts')
  expect(list.body.posts.map((p: { title: string }) => p.title)).toEqual(['Sima hír', 'Oktatási hír', 'Esti hír'])
  expect(list.body.posts[0].categories).toEqual(['Hírek'])
  expect((await s.client().get('/api/public/posts/titkos-piszkozat')).status).toBe(404)
  expect(list.headers.get('cache-control')).toBe('public, max-age=60')
})

test('category filter by name includes subcategories; search folds accents', async () => {
  const oktatas = await s.client().get(`/api/public/posts?category=${encodeURIComponent('Oktatás')}`)
  expect(oktatas.body.posts.map((p: { title: string }) => p.title).sort()).toEqual(['Esti hír', 'Oktatási hír'])
  const esti = await s.client().get(`/api/public/posts?category=${encodeURIComponent('esti munkarend')}`)
  expect(esti.body.total).toBe(1)
  expect((await s.client().get('/api/public/posts?category=nincs')).body.total).toBe(0)
  expect((await s.client().get('/api/public/posts?q=OKTATASI')).body.total).toBe(1)
})

test('pages: published only, with the other language as alternate; the site has both menus', async () => {
  const about = await s.client().get('/api/public/pages/en/about-us')
  expect(about.body.page.alternate).toEqual({ locale: 'hu', slug: 'bemutatkozas' })
  expect((await s.client().get('/api/public/pages/en/vegyipar-agazat')).status).toBe(404)
  const hu = await s.client().get('/api/public/site/hu')
  expect(hu.body.menu[0]).toEqual({ label: 'Kezdőlap', href: '/' })
  expect((await s.client().get('/api/public/site/en')).body.menu[0]).toEqual({ label: 'Home', href: '/en' })
  expect(hu.body.library.categories.length).toBeGreaterThan(3)
  expect(hu.body.translations).toContainEqual({ hu: 'bemutatkozas', en: 'about-us' })
})

test('resolve: old /<slug> news URLs point to /hirek/<slug>; pages win', async () => {
  expect((await s.client().get('/api/public/resolve?path=/esti-hir')).body).toEqual({ redirect: '/hirek/esti-hir' })
  expect((await s.client().get('/api/public/resolve?path=/elerhetoseg')).body).toEqual({ redirect: null, live: true })
  expect((await s.client().get('/api/public/resolve?path=/titkos-piszkozat')).status).toBe(404)
  expect((await s.client().get('/api/public/resolve?path=nincs-perjel')).status).toBe(400)
})

test('preview: only the user who made it can open it', async () => {
  const author = await s.login(DEMO.author)
  const made = await author.post('/api/preview', { kind: 'post', post: { title: 'Előnézet', content: doc('szöveg'), categoryIds: ['hirek'] } })
  expect(made.status).toBe(201)
  const mine = await author.get(`/api/preview/${made.body.id}`)
  expect(mine.body.post).toMatchObject({ title: 'Előnézet', categories: ['Hírek'] })
  expect((await s.client().get(`/api/preview/${made.body.id}`)).status).toBe(401)
  expect((await (await s.login(DEMO.reviewer)).get(`/api/preview/${made.body.id}`)).status).toBe(404)
  expect((await author.post('/api/preview', { kind: 'page', page: { title: 'x', blocks: [{ id: 'a', type: 'richText', props: { content: doc('x') } }] } })).status).toBe(403)
})

test('sitemap data: only published pages and posts, only slugs and dates', async () => {
  const res = await s.client().get('/api/public/sitemap')
  expect(res.status).toBe(200)
  expect(Object.keys(res.body).sort()).toEqual(['pages', 'posts', 'translations'])
  expect(res.body.pages).toContainEqual(expect.objectContaining({ locale: 'hu', slug: 'elerhetoseg' }))
  expect(res.body.pages).toContainEqual(expect.objectContaining({ locale: 'en', slug: 'about-us' }))
  expect(res.body.posts.map((p: { slug: string }) => p.slug).sort()).toEqual(['esti-hir', 'oktatasi-hir', 'sima-hir'])
  for (const entry of [...res.body.pages, ...res.body.posts]) expect(Object.keys(entry).every((k) => ['locale', 'slug', 'updatedAt'].includes(k))).toBe(true)
  expect(res.text).not.toContain('titkos-piszkozat')
  expect(res.body.translations).toContainEqual({ hu: 'elerhetoseg', en: 'contact' })
})
