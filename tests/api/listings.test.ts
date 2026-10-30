// Post lists, statistics and the log: on a fixed data set, with exact expected values. These guard the
// behaviour when filtering / sorting / paging moves from JavaScript into SQL.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'
import type { AuditAction, Post, PostStatus } from '../../shared/pnw/types.ts'

let server: TestServer
let reviewer: Client
let author: Client
let authorId: string
let reviewerId: string

const DAY = 24 * 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = Date.now()

let seq = 0
function makePost(partial: Partial<Post> & { status: PostStatus }): Post {
  seq += 1
  const id = `p${String(seq).padStart(3, '0')}`
  return {
    id,
    slug: id,
    title: `Hír ${id}`,
    content: [{ id: 'b', type: 'paragraph', runs: [{ text: `Szöveg ${id}` }] }],
    excerpt: '',
    categoryIds: ['cat-a'],
    tagIds: [],
    imagePosition: 'top',
    authorId: '',
    createdAt: iso(NOW - 100 * DAY),
    modifiedAt: iso(NOW - 100 * DAY + seq * 1000),
    date: iso(NOW - 100 * DAY + seq * 1000),
    ...partial,
  }
}

before(async () => {
  server = await startTestServer()
  reviewer = await server.login(DEMO.reviewer)
  author = await server.login(DEMO.author)
  authorId = ((await author.get('/api/auth/me')).body as { user: { id: string } }).user.id
  reviewerId = ((await reviewer.get('/api/auth/me')).body as { user: { id: string } }).user.id

  const { insertPost } = await import('../../server/data/posts-repo.ts')
  const { insertAuditEntry } = await import('../../server/data/audit-repo.ts')

  const posts: Post[] = []
  // 35 published posts for paging (30 / page); two of them this month.
  for (let i = 0; i < 35; i += 1) posts.push(makePost({ status: 'publish', authorId: i < 20 ? authorId : reviewerId, date: iso(NOW - (40 + i) * DAY) }))
  posts.push(makePost({ status: 'publish', authorId, title: 'Tavaszi koncert', date: iso(NOW - 1000), categoryIds: ['cat-b', 'cat-a'] }))
  posts.push(
    makePost({
      status: 'publish',
      authorId,
      title: 'Más téma',
      date: iso(NOW - 2000),
      content: [{ id: 'b', type: 'paragraph', runs: [{ text: 'A KONCERT a tornateremben lesz.' }] }],
      featuredImage: '/uploads/kiemelt.png',
    }),
  )
  posts.push(makePost({ status: 'publish', title: 'Képes hír', date: iso(NOW - 3000), content: [{ id: 'b', type: 'image', runs: [], image: { src: '/uploads/elso.png' } } as never] }))
  // The JSON structure's keys ("runs", "paragraph") do not match.
  posts.push(makePost({ status: 'pnw_archived', title: 'Archív hír', date: iso(NOW - 50 * DAY), origin: 'mirror', slug: 'regi-archiv' }))
  posts.push(makePost({ status: 'pnw_archived', title: 'Másik archív', date: iso(NOW - 60 * DAY) }))
  posts.push(makePost({ status: 'publish', origin: 'mirror', slug: 'regi-kint', date: iso(NOW - 70 * DAY) }))
  posts.push(makePost({ status: 'pending', authorId, title: 'Várakozó 1', modifiedAt: iso(NOW - 5 * DAY) }))
  posts.push(makePost({ status: 'pending', authorId: reviewerId, title: 'Várakozó 2', modifiedAt: iso(NOW - 6 * DAY) }))
  posts.push(makePost({ status: 'draft', authorId, title: 'Piszkozat', modifiedAt: iso(NOW - 2 * DAY) }))
  posts.push(makePost({ status: 'draft', authorId: reviewerId, title: 'Saját piszkozat', modifiedAt: iso(NOW - 3 * DAY) }))
  posts.push(makePost({ status: 'pnw_revision', authorId, title: 'Visszaküldve', modifiedAt: iso(NOW - 1 * DAY) }))
  posts.push(makePost({ status: 'future', authorId, title: 'Időzített később', date: iso(NOW + 5 * DAY), categoryIds: ['cat-b'] }))
  posts.push(makePost({ status: 'future', authorId, title: 'Időzített hamarabb', date: iso(NOW + 2 * DAY) }))
  for (const post of posts) await insertPost(post)

  const entry = (postId: string, action: AuditAction, at: number) =>
    insertAuditEntry({ id: `${postId}-${action}-${at}`, entityType: 'post', entityId: postId, postId, userId: null, action, fromStatus: '', toStatus: '', createdAt: iso(at) })
  // Approval times: 1 h and 3 h → average 2 h. One post without a decision, one imported entry.
  await entry('p001', 'submitted', NOW - 10 * DAY)
  await entry('p001', 'approved', NOW - 10 * DAY + 3600_000)
  await entry('p002', 'submitted', NOW - 9 * DAY)
  await entry('p002', 'scheduled', NOW - 9 * DAY + 3 * 3600_000)
  await entry('p003', 'submitted', NOW - 8 * DAY)
  for (let i = 0; i < 5; i += 1) await entry(`p01${i}`, 'imported', NOW - 200 * DAY)
})
after(() => server.close())

type ListBody = { posts: Post[]; total: number; totalPages: number }

test('published posts: date descending, 30 / page', async () => {
  const first = (await reviewer.get('/api/posts/published')).body as ListBody
  assert.equal(first.total, 39)
  assert.equal(first.totalPages, 2)
  assert.equal(first.posts.length, 30)
  assert.deepEqual(first.posts.slice(0, 3).map((p) => p.title), ['Tavaszi koncert', 'Más téma', 'Képes hír'])
  const dates = first.posts.map((p) => p.date)
  assert.deepEqual(dates, [...dates].sort().reverse())
  const second = (await reviewer.get('/api/posts/published?page=2')).body as ListBody
  assert.equal(second.posts.length, 9)
  assert.equal(new Set([...first.posts, ...second.posts].map((p) => p.id)).size, 39)
})

test('search in title and text, case-insensitive', async () => {
  const body = (await reviewer.get('/api/posts/published?q=koncert')).body as ListBody
  assert.deepEqual(body.posts.map((p) => p.title), ['Tavaszi koncert', 'Más téma'])
  assert.equal(body.total, 2)
  // The stored JSON structure does not match.
  assert.equal(((await reviewer.get('/api/posts/published?q=paragraph')).body as ListBody).total, 0)
  assert.equal(((await reviewer.get('/api/posts/published?q=runs')).body as ListBody).total, 0)
  // LIKE's special characters are taken literally.
  assert.equal(((await reviewer.get('/api/posts/published?q=%25')).body as ListBody).total, 0)
})

test('archived posts', async () => {
  const body = (await reviewer.get('/api/posts/archived')).body as ListBody
  assert.deepEqual(body.posts.map((p) => p.title), ['Archív hír', 'Másik archív'])
})

test('approver dashboard', async () => {
  const body = (await reviewer.get('/api/posts/dashboard')).body as Record<string, unknown> & {
    pending: Post[]
    ownWorking: Post[]
    scheduled: Post[]
    recent: Post[]
  }
  assert.equal(body.view, 'reviewer')
  assert.equal(body.pendingCount, 2)
  assert.equal(body.returnedCount, 1)
  assert.equal(body.scheduledCount, 2)
  assert.equal(body.publishedTodayCount, 3)
  // The longest-waiting first.
  assert.deepEqual(body.pending.map((p) => p.title), ['Várakozó 2', 'Várakozó 1'])
  assert.deepEqual(body.ownWorking.map((p) => p.title), ['Saját piszkozat'])
  assert.deepEqual(body.scheduled.map((p) => p.title), ['Időzített hamarabb', 'Időzített később'])
  assert.equal(body.recent.length, 10)
  assert.equal(body.recent[0].title, 'Visszaküldve')
  const modified = body.recent.map((p) => p.modifiedAt)
  assert.deepEqual(modified, [...modified].sort().reverse())
})

test('author dashboard: only own posts', async () => {
  const body = (await author.get('/api/posts/dashboard')).body as { view: string; counts: Record<string, number>; posts: Post[] }
  assert.equal(body.view, 'author')
  assert.deepEqual(body.counts, { draft: 1, pending: 1, pnw_revision: 1, future: 2, publish: 22 })
  assert.equal(body.posts.length, 27)
  assert.ok(body.posts.every((p) => p.authorId === authorId))
  const modified = body.posts.map((p) => p.modifiedAt)
  assert.deepEqual(modified, [...modified].sort().reverse())
})

test('public list: only published, newest first, without content, with thumbnail', async () => {
  const body = (await server.client().get('/api/public/posts?limit=3')).body as { posts: (Post & { thumbnail?: string })[] }
  assert.deepEqual(body.posts.map((p) => p.title), ['Tavaszi koncert', 'Más téma', 'Képes hír'])
  assert.ok(!body.posts.some((p) => 'content' in p))
  assert.equal(body.posts[1].thumbnail, '/uploads/kiemelt.png')
  assert.equal(body.posts[2].thumbnail, '/uploads/elso.png')
  assert.equal(((await server.client().get('/api/public/posts')).body as { posts: Post[] }).posts.length, 20)
})

test('hidden mirrored posts', async () => {
  const body = (await server.client().get('/api/public/posts/hidden-mirror')).body as { slugs: string[] }
  assert.deepEqual(body.slugs, ['regi-archiv'])
})

test('statisztika', async () => {
  const body = (await reviewer.get('/api/statistics')).body as Record<string, unknown> & {
    monthlyChart: { key: string; count: number }[]
    topAuthors: { key: string; count: number }[]
    topCategories: { key: string; count: number }[]
  }
  assert.equal(body.liveAll, 39)
  assert.equal(body.scheduled, 2)
  assert.equal(body.pending, 2)
  assert.equal(body.archived, 2)
  assert.equal(body.averageApprovalSeconds, 7200)
  const monthKey = new Date().toISOString().slice(0, 7)
  assert.equal(body.monthlyChart.length, 6)
  assert.equal(body.monthlyChart[5].key, monthKey)
  // Published and archived posts per month (the monthly figure is the same for the last month).
  assert.equal(body.monthPublished, body.monthlyChart[5].count)
  const expectedRecent = 3
  assert.ok(body.monthlyChart[5].count >= expectedRecent)
  assert.deepEqual(body.topAuthors.slice(0, 2), [
    { key: authorId, count: 24 },
    { key: reviewerId, count: 15 },
  ])
  assert.deepEqual(body.topCategories, [
    { key: 'cat-a', count: 42 },
    { key: 'cat-b', count: 2 },
  ])
})

test('log: imported entries are left out by default, the limit applies', async () => {
  const body = (await reviewer.get('/api/audit')).body as { entries: { action: string }[] }
  assert.equal(body.entries.length, 5)
  assert.ok(body.entries.every((e) => e.action !== 'imported'))
  assert.equal(body.entries[0].action, 'submitted')
  const all = (await reviewer.get('/api/audit?imported=1')).body as { entries: { action: string }[] }
  assert.equal(all.entries.length, 10)
  const limited = (await reviewer.get('/api/audit?limit=2')).body as { entries: unknown[] }
  assert.equal(limited.entries.length, 2)
})

test('scheduled sweep: only the due ones get published', async () => {
  const { sweepScheduledPosts } = await import('../../server/app.ts')
  await server.sql("UPDATE posts SET date = $1 WHERE title = 'Időzített hamarabb'", [iso(Date.now() - 1000)])
  await sweepScheduledPosts()
  const rows = await server.sql<{ title: string; status: string }>("SELECT title, status FROM posts WHERE title LIKE 'Időzített%' ORDER BY title")
  assert.deepEqual(rows, [
    { title: 'Időzített hamarabb', status: 'publish' },
    { title: 'Időzített később', status: 'future' },
  ])
})

test('the search text is refreshed on save', async () => {
  const { updatePost } = await import('../../server/data/posts-repo.ts')
  await updatePost('p005', (post) => ({ ...post, title: 'Átnevezett Évzáró' }))
  const body = (await reviewer.get('/api/posts/published?q=%C3%89VZ%C3%81R%C3%93')).body as ListBody
  assert.deepEqual(body.posts.map((p) => p.id), ['p005'])
})
