// Serving media from the database, in chunks (lib/media.ts): full file, ETag/304, Range, HEAD.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer
/** A file of several chunks (256 KB), so that the chunk boundaries matter too. */
const SIZE = 600 * 1024 + 7
const bytes = Buffer.alloc(SIZE)
for (let i = 0; i < SIZE; i += 1) bytes[i] = (i * 31 + 7) % 256

before(async () => {
  server = await startTestServer()
  const { putMedia } = await import('../../server/data/media-repo.ts')
  await putMedia('/media/teszt/nagy.pdf', 'application/pdf', bytes)
  await putMedia('/media/teszt/ures.txt', 'text/plain; charset=utf-8', Buffer.alloc(0))
})
after(() => server.close())

async function fetchRaw(path: string, init: RequestInit = {}) {
  const res = await fetch(server.url + path, init)
  return { res, body: Buffer.from(await res.arrayBuffer()) }
}

test('the full file, byte-exact, with Content-Length', async () => {
  const { res, body } = await fetchRaw('/media/teszt/nagy.pdf', { headers: { 'accept-encoding': 'identity' } })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  assert.equal(res.headers.get('content-length'), String(SIZE))
  assert.equal(res.headers.get('accept-ranges'), 'bytes')
  assert.ok(body.equals(bytes))
})

test('If-None-Match match: 304, no body', async () => {
  const first = await fetchRaw('/media/teszt/nagy.pdf')
  const etag = first.res.headers.get('etag')!
  const { res, body } = await fetchRaw('/media/teszt/nagy.pdf', { headers: { 'if-none-match': etag } })
  assert.equal(res.status, 304)
  assert.equal(body.length, 0)
})

test('Range: a slice crossing a chunk boundary', async () => {
  const start = 256 * 1024 - 10
  const end = 256 * 1024 + 20
  const { res, body } = await fetchRaw('/media/teszt/nagy.pdf', { headers: { range: `bytes=${start}-${end}` } })
  assert.equal(res.status, 206)
  assert.equal(res.headers.get('content-range'), `bytes ${start}-${end}/${SIZE}`)
  assert.ok(body.equals(bytes.subarray(start, end + 1)))
})

test('Range: open end and last n bytes', async () => {
  const open = await fetchRaw('/media/teszt/nagy.pdf', { headers: { range: `bytes=${SIZE - 5}-` } })
  assert.ok(open.body.equals(bytes.subarray(SIZE - 5)))
  const suffix = await fetchRaw('/media/teszt/nagy.pdf', { headers: { range: 'bytes=-3' } })
  assert.equal(suffix.res.status, 206)
  assert.ok(suffix.body.equals(bytes.subarray(SIZE - 3)))
})

test('Range beyond the file → 416', async () => {
  const { res } = await fetchRaw('/media/teszt/nagy.pdf', { headers: { range: `bytes=${SIZE}-` } })
  assert.equal(res.status, 416)
  assert.equal(res.headers.get('content-range'), `bytes */${SIZE}`)
})

test('HEAD: headers without a body', async () => {
  const { res, body } = await fetchRaw('/media/teszt/nagy.pdf', { method: 'HEAD' })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-length'), String(SIZE))
  assert.equal(body.length, 0)
})

test('empty file and missing file', async () => {
  const empty = await fetchRaw('/media/teszt/ures.txt')
  assert.equal(empty.res.status, 200)
  assert.equal(empty.body.length, 0)
  assert.equal((await fetchRaw('/media/teszt/nincs.pdf')).res.status, 404)
  assert.equal((await fetchRaw('/media/teszt/..%2F..%2Fx')).res.status, 404)
})

test('after migration 002 the data column uses EXTERNAL storage', async () => {
  const [row] = await server.sql<{ attstorage: string }>(
    "SELECT attstorage FROM pg_attribute WHERE attrelid = 'media_files'::regclass AND attname = 'data'",
  )
  assert.equal(row.attstorage, 'e')
})
