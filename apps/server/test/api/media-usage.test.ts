/** C4 / A2: a file in use cannot be deleted; documents are listed and deletable; unused uploads; unguessable names. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { auditLog, media } from '../../src/db/schema.ts'
import { DEMO, PNG_BYTES, doc, fileForm, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
let author: Client
let editor: Client
let reviewer: Client
beforeAll(async () => {
  s = await startTestServer({ content: true })
  admin = await s.login(DEMO.admin)
  author = await s.login(DEMO.author)
  reviewer = await s.login(DEMO.reviewer)
  await admin.post('/api/users', { username: 'oldalszerk', displayName: 'Oldal Szerkesztő', role: 'editor', password: 'OldalSzerkeszto1' })
  editor = await s.login({ username: 'oldalszerk', password: 'OldalSzerkeszto1' })
})
afterAll(() => s.close())

const upload = async (client: Client, path: string, name: string, bytes: Uint8Array | string, type: string) => {
  const res = await client.post(path, fileForm(name, bytes, type))
  expect(res.status).toBe(200)
  return res.body as { id: string; url: string }
}
const pdf = (client: Client, name = 'Tanmenet 2026.pdf') => upload(client, '/api/library/file', name, '%PDF-1.4 tanmenet', 'application/pdf')
const block = (props: Record<string, unknown>) => [{ id: 'b1', type: 'pageTitle', props: { breadcrumb: [], title: 'Kép', ...props } }]

describe('unguessable names', () => {
  test('documents and images get 128 random bits (22 base64url characters)', async () => {
    const document = await pdf(editor)
    expect(document.url).toMatch(/^\/uploads\/tanmenet-2026-[A-Za-z0-9_-]{22}\.pdf$/)
    const image = await upload(author, '/api/media', 'kep.png', PNG_BYTES, 'image/png')
    expect(image.url).toMatch(/^\/uploads\/[A-Za-z0-9_-]{22}\.png$/)
  })

  test('POST /api/library/file returns the id as well', async () => {
    const res = await pdf(editor, 'masik.pdf')
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('documents in the media library', () => {
  test('listed with name, size, date and uploader; images are not in the list', async () => {
    const document = await pdf(editor, 'Lista próba.pdf')
    const list = await editor.get('/api/media?kind=documents')
    const item = list.body.items.find((i: { id: string }) => i.id === document.id)
    expect(item).toMatchObject({ url: document.url, mime: 'application/pdf', uploadedBy: 'Oldal Szerkesztő' })
    expect(item.size).toBeGreaterThan(0)
    expect(item.name).toStartWith('lista-proba-')
    expect(list.body.items.every((i: { mime: string }) => !i.mime.startsWith('image/'))).toBe(true)
  })

  test('only library or page editors see and delete documents', async () => {
    expect((await author.get('/api/media?kind=documents')).status).toBe(403)
    const document = await pdf(editor, 'jog.pdf')
    expect((await author.delete(`/api/media/${document.id}`)).status).toBe(403)
    expect((await reviewer.delete(`/api/media/${document.id}`)).status).toBe(403)
    expect((await editor.delete(`/api/media/${document.id}`)).body).toEqual({ ok: true })
    expect((await s.client().get(document.url)).status).toBe(404)
    const [entry] = await s.db.select().from(auditLog).where(and(eq(auditLog.entityId, document.id), eq(auditLog.action, 'media_deleted')))
    expect(entry.subject).toBe(document.url)
  })

  test('a document in the library list cannot be deleted: 409 with the place; after removing it from the list it can', async () => {
    const document = await pdf(editor, 'listaban.pdf')
    const loaded = (await editor.get('/api/library')).body
    const library = { categories: [{ slug: 'proba', title: 'Próba', docs: [{ slug: 'listaban', title: 'Listában', file: document.url }] }, ...loaded.library.categories] }
    const saved = await editor.put('/api/library', { library, version: loaded.version })
    expect(saved.status).toBe(200)
    const refused = await editor.delete(`/api/media/${document.id}`)
    expect(refused.status).toBe(409)
    expect(refused.body).toEqual({ error: 'in_use', usages: [{ kind: 'library' }] })
    await editor.put('/api/library', { library: loaded.library, version: saved.body.version })
    expect((await editor.delete(`/api/media/${document.id}`)).status).toBe(200)
  })

  test('lookup by address', async () => {
    const document = await pdf(editor, 'kereses.pdf')
    expect((await editor.get(`/api/media/lookup?path=${encodeURIComponent(document.url)}`)).body.item.id).toBe(document.id)
    expect((await editor.get('/api/media/lookup?path=/uploads/nincs.pdf')).status).toBe(404)
  })
})

describe('images in use', () => {
  test('in a page block, a post’s TipTap content, a cover image and the menu: 409 with every place', async () => {
    const image = await upload(author, '/api/media', 'hasznalt.png', PNG_BYTES, 'image/png')
    const page = (await admin.post('/api/pages', { slug: 'kepes-oldal', title: 'Képes oldal', status: 'draft', blocks: block({ cover: { src: image.url, alt: '' } }) })).body.page
    const content = { type: 'doc', content: [{ type: 'image', attrs: { src: `${image.url}?w=960&f=webp`, alt: 'x' } }] }
    const inText = (await author.post('/api/posts', { title: 'Képes hír', content, categoryIds: ['hirek'] })).body.post
    const cover = (await author.post('/api/posts', { title: 'Borítós hír', content: doc('x'), categoryIds: ['hirek'], featuredImage: image.url })).body.post
    const menu = (await admin.get('/api/pages/menu/en')).body
    await admin.put('/api/pages/menu/en', { menu: [...menu.menu, { label: 'Kép', href: image.url }], version: menu.version })
    const refused = await admin.delete(`/api/media/${image.id}`)
    expect(refused.status).toBe(409)
    const places = refused.body.usages.map((u: { kind: string; id?: string; locale?: string }) => `${u.kind}:${u.id ?? u.locale ?? ''}`).sort()
    expect(places).toEqual([`page:${page.id}`, `post:${cover.id}`, `post:${inText.id}`, 'menu:en'].sort())
    expect((await admin.get(`/api/media/${image.id}/usages`)).body.usages).toHaveLength(4)
    expect(await s.db.select().from(media).where(eq(media.id, image.id))).toHaveLength(1)
  })

  test('a similar but longer path does not count as a use', async () => {
    const image = await upload(author, '/api/media', 'egyedi.png', PNG_BYTES, 'image/png')
    await admin.post('/api/pages', { slug: 'hasonlo', title: 'Hasonló', status: 'draft', blocks: block({ cover: { src: `${image.url}.regi.png`, alt: '' } }) })
    expect((await admin.get(`/api/media/${image.id}/usages`)).body.usages).toEqual([])
  })
})

describe('cleanup', () => {
  test('lists the uploads used nowhere; used ones are not listed; authors cannot see it', async () => {
    const unused = await upload(author, '/api/media', 'arva.png', PNG_BYTES, 'image/png')
    const used = await upload(author, '/api/media', 'hasznalatban.png', PNG_BYTES, 'image/png')
    await author.post('/api/posts', { title: 'Használja', content: doc('x'), categoryIds: ['hirek'], featuredImage: used.url })
    const list = (await admin.get('/api/media/unused')).body.items.map((i: { id: string }) => i.id)
    expect(list).toContain(unused.id)
    expect(list).not.toContain(used.id)
    expect((await author.get('/api/media/unused')).status).toBe(403)
    expect((await admin.delete(`/api/media/${unused.id}`)).status).toBe(200)
  })
})
