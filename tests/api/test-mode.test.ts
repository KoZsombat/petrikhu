// PNW_TEST_MODE=true: a jóváhagyás nem publikál, a kint lévő hírek kezelése tiltott. Külön folyamat, mert a config
// a modul betöltésekor olvassa a változót.
process.env.PNW_TEST_MODE = 'true'

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'
import type { Post } from '../../shared/pnw/types.ts'

let server: TestServer
let author: Client
let reviewer: Client

before(async () => {
  server = await startTestServer()
  author = await server.login(DEMO.author)
  reviewer = await server.login(DEMO.reviewer)
})
after(() => server.close())

async function submitted(): Promise<Post> {
  const [category] = await server.sql<{ id: string }>("SELECT id FROM terms WHERE kind = 'category' LIMIT 1")
  const res = await author.post('/api/posts', {
    title: 'Teszt hír',
    content: JSON.stringify([{ id: 'b', type: 'paragraph', runs: [{ text: 'x' }] }]),
    categoryIds: [category.id],
    command: 'submit',
  })
  return (res.body as { post: Post }).post
}

test('jóváhagyás: pnw_test_ok, nem nyilvános', async () => {
  const post = await submitted()
  assert.equal((await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', note: '' })).status, 200)
  const [row] = await server.sql<{ status: string }>('SELECT status FROM posts WHERE id = $1', [post.id])
  assert.equal(row.status, 'pnw_test_ok')
  assert.equal((await server.client().get(`/api/public/posts/${post.slug}`)).status, 404)
})

test('időzítés helyett azonnali (teszt) jóváhagyás', async () => {
  const post = await submitted()
  const publishAt = new Date(Date.now() + 3600_000).toISOString()
  await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', note: '', publishMode: 'schedule', publishAt })
  const [row] = await server.sql<{ status: string }>('SELECT status FROM posts WHERE id = $1', [post.id])
  assert.equal(row.status, 'pnw_test_ok')
})

test('kint lévő hír szerkesztése és archiválása tiltott, a lista jelzi a tesztüzemet', async () => {
  assert.deepEqual((await reviewer.post('/api/posts/x/archive')).body, { error: 'production_only' })
  assert.equal((await reviewer.put('/api/posts/x/published', {})).status, 403)
  assert.equal(((await reviewer.get('/api/posts/published')).body as { testMode: boolean }).testMode, true)
})
