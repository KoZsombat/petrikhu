import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { eq } from 'drizzle-orm'
import { media, mediaVariants } from '../../src/db/schema.ts'
import { CHUNK_BYTES, encodeStats, generateMissingVariants, putMediaIfMissing } from '../../src/lib/media.ts'
import { DEMO, PNG_BYTES, doc, fileForm, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
let author: Client
let big: Buffer
beforeAll(async () => {
  s = await startTestServer()
  admin = await s.login(DEMO.admin)
  author = await s.login(DEMO.author)
  big = Buffer.alloc(CHUNK_BYTES * 2 + 1234)
  for (let i = 0; i < big.length; i += 1) big[i] = (i * 7) % 251
  await putMediaIfMissing(s.db, '/media/wp-content/uploads/2020/nagy.pdf', big)
})
afterAll(() => s.close())

const jpeg = (width: number) => sharp({ create: { width, height: Math.round(width / 2), channels: 3, background: '#2b8272' } }).jpeg().toBuffer()

describe('image uploads', () => {
  test('a real image → url; variants in WebP and AVIF, never wider than the original', async () => {
    const res = await author.post('/api/media', fileForm('Kép.JPG', await jpeg(1200), 'image/jpeg'))
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/)
    const variants = await s.db.select({ width: mediaVariants.width, format: mediaVariants.format }).from(mediaVariants).where(eq(mediaVariants.mediaId, res.body.id))
    expect(variants.map((v) => `${v.width}.${v.format}`).sort()).toEqual(['1200.avif', '1200.webp', '480.avif', '480.webp', '960.avif', '960.webp'])
    const original = await s.client().get(res.body.url)
    expect(original.headers.get('content-type')).toBe('image/jpeg')
    expect(original.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    const avif = await fetch(`${s.url}${res.body.url}?w=960&f=avif`)
    expect(avif.headers.get('content-type')).toBe('image/avif')
    const meta = await sharp(Buffer.from(await avif.arrayBuffer())).metadata()
    expect(meta.width).toBe(960)
    const wide = await fetch(`${s.url}${res.body.url}?w=1600&f=webp`)
    expect((await sharp(Buffer.from(await wide.arrayBuffer())).metadata()).width).toBe(1200)
  })

  test('older images get their variant on first request, then it is stored', async () => {
    await putMediaIfMissing(s.db, '/media/regi/kep.png', await sharp({ create: { width: 700, height: 300, channels: 3, background: '#fff' } }).png().toBuffer())
    const res = await fetch(`${s.url}/media/regi/kep.png?w=480&f=webp`)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    const [row] = await s.db.select().from(media).where(eq(media.path, '/media/regi/kep.png'))
    expect(await s.db.select().from(mediaVariants).where(eq(mediaVariants.mediaId, row.id))).toHaveLength(1)
  })

  test('parallel first requests for a missing variant share one encode', async () => {
    await putMediaIfMissing(s.db, '/media/regi/parhuzamos.png', await sharp({ create: { width: 900, height: 300, channels: 3, background: '#abc' } }).png().toBuffer())
    const before = encodeStats.count
    const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(`${s.url}/media/regi/parhuzamos.png?w=480&f=avif`)))
    expect(responses.every((res) => res.status === 200 && res.headers.get('content-type') === 'image/avif')).toBe(true)
    const sizes = new Set(await Promise.all(responses.map(async (res) => (await res.arrayBuffer()).byteLength)))
    expect(sizes.size).toBe(1)
    expect(encodeStats.count - before).toBe(1)
  })

  test('media:variants makes every missing variant of the old images, once', async () => {
    await putMediaIfMissing(s.db, '/media/regi/kotegelt.png', await sharp({ create: { width: 2000, height: 500, channels: 3, background: '#123' } }).png().toBuffer())
    const made = await generateMissingVariants(s.db)
    expect(made).toBeGreaterThanOrEqual(6)
    const [row] = await s.db.select().from(media).where(eq(media.path, '/media/regi/kotegelt.png'))
    const variants = await s.db.select({ width: mediaVariants.width, format: mediaVariants.format }).from(mediaVariants).where(eq(mediaVariants.mediaId, row.id))
    expect(variants.map((v) => `${v.width}.${v.format}`).sort()).toEqual(['1600.avif', '1600.webp', '480.avif', '480.webp', '960.avif', '960.webp'])
    expect(await generateMissingVariants(s.db)).toBe(0)
  })

  test('forbidden extension or content that does not match it → 422', async () => {
    for (const name of ['x.exe', 'x.html', 'x.php', 'x']) expect((await author.post('/api/media', fileForm(name, PNG_BYTES, 'image/png'))).status).toBe(422)
    expect((await author.post('/api/media', fileForm('x.png', 'not a png at all', 'image/png'))).body).toEqual({ error: 'not_an_image' })
    expect((await author.post('/api/media', fileForm('x.svg', '<html><script>x</script></html>', 'image/svg+xml'))).status).toBe(422)
  })

  test('SVG is accepted but served with a sandbox CSP', async () => {
    const res = await author.post('/api/media', fileForm('rajz.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'))
    const served = await s.client().get(res.body.url)
    expect(served.headers.get('content-security-policy')).toStartWith('sandbox')
    expect(served.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('no file / wrong field → 400 upload_failed; too large → 413 file_too_large', async () => {
    expect((await author.post('/api/media', fileForm('x.png', PNG_BYTES, 'image/png', 'other'))).body).toEqual({ error: 'upload_failed' })
    expect((await author.post('/api/media', { not: 'multipart' })).status).toBe(400)
    const huge = await author.post('/api/media', fileForm('x.png', new Uint8Array(8 * 1024 * 1024 + 10), 'image/png'))
    expect(huge.status).toBe(413)
    expect(huge.body).toEqual({ error: 'file_too_large' })
    const bigger = await author.post('/api/media', fileForm('x.png', new Uint8Array(11 * 1024 * 1024), 'image/png'))
    expect(bigger.status).toBe(413)
  })

  test('the media library lists uploads; without the right 401/403', async () => {
    expect((await admin.get('/api/media')).body.items.length).toBeGreaterThan(0)
    expect((await s.client().get('/api/media')).status).toBe(401)
    expect((await s.client().post('/api/media', fileForm('x.png', PNG_BYTES, 'image/png'))).status).toBe(401)
  })
})

describe('documents (library uploads)', () => {
  test('.pdf accepted under a slugified name and served', async () => {
    const res = await admin.post('/api/library/file', fileForm('Házirend 2024 (végleges).pdf', '%PDF-1.4', 'application/pdf'))
    expect(res.body.url).toMatch(/^\/uploads\/hazirend-2024-vegleges-[0-9a-f]{6}\.pdf$/)
    const served = await s.client().get(res.body.url)
    expect(served.headers.get('content-type')).toBe('application/pdf')
    expect(served.headers.get('content-security-policy')).not.toStartWith('sandbox')
  })
  test('docx, xlsx, zip, txt pass (office files sandboxed); exe, html, svg, js, none → 422', async () => {
    for (const name of ['a.docx', 'a.xlsx', 'a.zip', 'a.txt']) expect((await admin.post('/api/library/file', fileForm(name, 'x'))).status).toBe(200)
    const docx = await admin.post('/api/library/file', fileForm('b.docx', 'x'))
    expect((await s.client().get(docx.body.url)).headers.get('content-security-policy')).toStartWith('sandbox')
    for (const name of ['a.exe', 'a.html', 'a.svg', 'a.js', 'noext']) expect((await admin.post('/api/library/file', fileForm(name, 'x'))).body).toEqual({ error: 'unsupported_file' })
  })
  test('path traversal names are slugged; the author has no access', async () => {
    const res = await admin.post('/api/library/file', fileForm('../../etc/passwd.pdf', 'x'))
    expect(res.body.url).toMatch(/^\/uploads\/etc-passwd-[0-9a-f]{6}\.pdf$/)
    expect((await author.post('/api/library/file', fileForm('a.pdf', 'x'))).status).toBe(403)
  })
})

describe('serving', () => {
  const path = '/media/wp-content/uploads/2020/nagy.pdf'
  test('the full file, byte-exact, with Content-Length and ETag; If-None-Match → 304', async () => {
    const res = await fetch(s.url + path)
    expect(Buffer.from(await res.arrayBuffer()).equals(big)).toBe(true)
    expect(res.headers.get('content-length')).toBe(String(big.length))
    const etag = res.headers.get('etag')!
    const again = await fetch(s.url + path, { headers: { 'if-none-match': etag } })
    expect(again.status).toBe(304)
  })
  test('ranges: across a chunk boundary, open end, suffix; beyond the file → 416', async () => {
    const r1 = await fetch(s.url + path, { headers: { range: `bytes=${CHUNK_BYTES - 10}-${CHUNK_BYTES + 9}` } })
    expect(r1.status).toBe(206)
    expect(Buffer.from(await r1.arrayBuffer()).equals(big.subarray(CHUNK_BYTES - 10, CHUNK_BYTES + 10))).toBe(true)
    expect(r1.headers.get('content-range')).toBe(`bytes ${CHUNK_BYTES - 10}-${CHUNK_BYTES + 9}/${big.length}`)
    const r2 = await fetch(s.url + path, { headers: { range: `bytes=${big.length - 5}-` } })
    expect(Buffer.from(await r2.arrayBuffer()).equals(big.subarray(big.length - 5))).toBe(true)
    const r3 = await fetch(s.url + path, { headers: { range: 'bytes=-3' } })
    expect(Buffer.from(await r3.arrayBuffer()).equals(big.subarray(big.length - 3))).toBe(true)
    expect((await fetch(s.url + path, { headers: { range: `bytes=${big.length + 1}-` } })).status).toBe(416)
  })
  test('HEAD: headers without a body; missing files and traversal → 404', async () => {
    const head = await fetch(s.url + path, { method: 'HEAD' })
    expect(head.headers.get('content-length')).toBe(String(big.length))
    expect((await head.arrayBuffer()).byteLength).toBe(0)
    expect((await fetch(`${s.url}/media/nincs.pdf`)).status).toBe(404)
    expect((await fetch(`${s.url}/media/%2e%2e/%2e%2e/etc/passwd`)).status).toBe(404)
  })
  test('the data column uses EXTERNAL storage', async () => {
    const rows = await s.sql`SELECT attstorage FROM pg_attribute WHERE attrelid = 'media'::regclass AND attname = 'data'`
    expect(rows[0].attstorage).toBe('e')
  })
})

describe('body limits are route-scoped', () => {
  test('small default limit on ordinary calls; the large limit only on page/post save', async () => {
    const padding = 'x'.repeat(200 * 1024)
    const term = await admin.post('/api/terms', JSON.stringify({ kind: 'tag', name: 'x', padding }))
    expect(term.status).toBe(413)
    expect(term.body).toEqual({ error: 'payload_too_large' })
    const login = await s.client().post('/api/auth/login', JSON.stringify({ username: 'x', password: padding }))
    expect(login.status).toBe(413)
    const paragraphs = Array.from({ length: 20 }, () => 'Hosszú bekezdés. '.repeat(1000))
    const post = await author.post('/api/posts', { title: 'Hosszú hír', content: doc(...paragraphs), categoryIds: ['hirek'] })
    expect(post.status).toBe(201)
    const pageBlocks = [{ id: 'a', type: 'richText', props: { content: doc(...paragraphs) } }]
    expect((await admin.post('/api/pages', { title: 'Hosszú oldal', blocks: pageBlocks })).status).toBe(201)
    const tooBig = await admin.post('/api/pages', { title: 'Túl hosszú', blocks: [{ id: 'a', type: 'richText', props: { content: doc('x'.repeat(9 * 1024 * 1024)) } }] })
    expect(tooBig.status).toBe(413)
  })
})

test('security headers on API responses; /api is no-store', async () => {
  const res = await s.client().get('/api/public/site/hu')
  expect(res.headers.get('content-security-policy')).toContain("script-src 'self'")
  expect(res.headers.get('content-security-policy')).not.toContain('googleapis')
  expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  expect((await admin.get('/api/auth/me')).headers.get('cache-control')).toBe('no-store')
})

test('statistics: SQL aggregates for the reviewers', async () => {
  const stats = await admin.get('/api/statistics')
  expect(stats.body).toMatchObject({ published: 0, inReview: 0 })
  expect(stats.body.monthlyChart).toHaveLength(6)
  expect((await author.get('/api/statistics')).status).toBe(403)
})
