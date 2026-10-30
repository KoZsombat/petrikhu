// 1.1: a méretkorlátot túllépő feltöltés minden feltöltő végponton 413-at ad (nem 500-at).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, fileForm, PNG_BYTES, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'

let server: TestServer
let author: Client
let reviewer: Client

before(async () => {
  server = await startTestServer()
  author = await server.login(DEMO.author)
  reviewer = await server.login(DEMO.reviewer)
})
after(() => server.close())

/** Érvényes PNG-fejléc, de a megadott méretre felfújva. */
function bigPng(bytes: number): Uint8Array {
  const buffer = new Uint8Array(bytes)
  buffer.set(PNG_BYTES)
  return buffer
}

const OVER_IMAGE_LIMIT = 8 * 1024 * 1024 + 1024
const OVER_DOCUMENT_LIMIT = 9 * 1024 * 1024 + 1024

const cases: { name: string; who: () => Client; method: 'POST' | 'PUT'; path: string; field: string; size: number; name_: string }[] = [
  { name: 'Szerkesztő médiatár', who: () => reviewer, method: 'POST', path: '/api/pages/media', field: 'file', size: OVER_IMAGE_LIMIT, name_: 'a.png' },
  { name: 'hír szövegképe', who: () => author, method: 'POST', path: '/api/posts/media', field: 'file', size: OVER_IMAGE_LIMIT, name_: 'a.png' },
  { name: 'új hír kiemelt képe', who: () => author, method: 'POST', path: '/api/posts', field: 'featuredImage', size: OVER_IMAGE_LIMIT, name_: 'a.png' },
  { name: 'hír szerkesztése', who: () => author, method: 'PUT', path: '/api/posts/nincs-ilyen', field: 'featuredImage', size: OVER_IMAGE_LIMIT, name_: 'a.png' },
  { name: 'megjelent hír szerkesztése', who: () => reviewer, method: 'PUT', path: '/api/posts/nincs-ilyen/published', field: 'featuredImage', size: OVER_IMAGE_LIMIT, name_: 'a.png' },
  { name: 'Dokumentumtár', who: () => reviewer, method: 'POST', path: '/api/pages/library/file', field: 'file', size: OVER_DOCUMENT_LIMIT, name_: 'a.pdf' },
]

for (const c of cases) {
  test(`${c.name}: túl nagy fájl → 413 file_too_large`, async () => {
    const res = await c.who().request(c.method, c.path, fileForm(c.field, c.name_, bigPng(c.size), 'image/png'))
    assert.equal(res.status, 413)
    assert.deepEqual(res.body, { error: 'file_too_large' })
  })
}

test('váratlan mezőnév → 400 upload_failed', async () => {
  const res = await reviewer.post('/api/pages/media', fileForm('masik', 'a.png', PNG_BYTES, 'image/png'))
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: 'upload_failed' })
})
