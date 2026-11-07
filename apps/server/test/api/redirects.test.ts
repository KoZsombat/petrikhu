/** C5: a published page or post that changes its slug keeps its old address (301); chains collapse; no loops. E1. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { redirects } from '../../src/db/schema.ts'
import { addRedirect } from '../../src/lib/redirects.ts'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
let author: Client
beforeAll(async () => {
  s = await startTestServer({ content: true })
  admin = await s.login(DEMO.admin)
  author = await s.login(DEMO.author)
})
afterAll(() => s.close())

const block = (title: string) => [{ id: 'b1', type: 'pageTitle', props: { breadcrumb: [], title } }]
const resolve = async (path: string) => (await s.client().get(`/api/public/resolve?path=${encodeURIComponent(path)}`)).body.redirect
const table = async () => Object.fromEntries((await s.db.select().from(redirects)).map((r) => [r.fromPath, r.toPath]))

async function page(slug: string, status: 'draft' | 'published' = 'published', locale: 'hu' | 'en' = 'hu') {
  const res = await admin.post('/api/pages', { slug, locale, title: slug, status, blocks: block(slug) })
  expect(res.status).toBe(201)
  return res.body.page as { id: string; version: number }
}
const rename = async (id: string, slug: string, status: 'draft' | 'published' = 'published') =>
  admin.put(`/api/pages/${id}`, await s.versioned(id, { slug, title: slug, status, blocks: block(slug) }))

describe('pages', () => {
  test('renaming a published page: the old path redirects to the new one', async () => {
    const { id } = await page('regi-cim')
    expect((await rename(id, 'uj-cim')).status).toBe(200)
    expect(await resolve('/regi-cim')).toBe('/uj-cim')
    expect(await resolve('/uj-cim')).toBeNull()
  })

  test('a chain collapses: A → B → C gives A → C and B → C', async () => {
    const { id } = await page('lanc-a')
    await rename(id, 'lanc-b')
    await rename(id, 'lanc-c')
    const rows = await table()
    expect(rows['/lanc-a']).toBe('/lanc-c')
    expect(rows['/lanc-b']).toBe('/lanc-c')
  })

  test('renaming back never makes a loop: A → B, then B → A leaves only B → A', async () => {
    const { id } = await page('oda')
    await rename(id, 'vissza')
    await rename(id, 'oda')
    const rows = await table()
    expect(rows['/oda']).toBeUndefined()
    expect(rows['/vissza']).toBe('/oda')
  })

  test('an old path that becomes a real page again loses its redirect', async () => {
    const { id } = await page('foglalt-utvonal')
    await rename(id, 'mashova')
    expect(await resolve('/foglalt-utvonal')).toBe('/mashova')
    await page('foglalt-utvonal')
    expect((await table())['/foglalt-utvonal']).toBeUndefined()
    expect((await s.client().get('/api/public/resolve?path=/foglalt-utvonal')).body).toMatchObject({ live: true })
  })

  test('a draft page that is renamed leaves no redirect; English pages keep their /en/ prefix', async () => {
    const draft = await page('piszkozat-oldal', 'draft')
    await rename(draft.id, 'piszkozat-uj', 'draft')
    expect((await table())['/piszkozat-oldal']).toBeUndefined()
    const en = await page('old-english', 'published', 'en')
    await admin.put(`/api/pages/${en.id}`, await s.versioned(en.id, { slug: 'new-english', title: 'x', status: 'published', blocks: block('x') }))
    expect(await resolve('/en/old-english')).toBe('/en/new-english')
  })

  test('addRedirect directly: a redirect from a path is replaced, not duplicated', async () => {
    await addRedirect(s.db, '/x1', '/x2', null)
    await addRedirect(s.db, '/x1', '/x3', null)
    expect((await table())['/x1']).toBe('/x3')
  })
})

describe('posts', () => {
  test('a reviewer renames a published post: /hirek/<old> redirects; an author cannot rename', async () => {
    const id = (await author.post('/api/posts', { title: 'Átnevezendő hír', content: doc('x'), categoryIds: ['hirek'], command: 'submit' })).body.post.id
    expect((await author.put(`/api/posts/${id}`, await s.versioned(id, { title: 'Átnevezendő hír', content: doc('x'), categoryIds: ['hirek'], slug: 'szerzo-nem' }))).status).toBe(403)
    await admin.post(`/api/posts/${id}/decision`, { decision: 'approve' })
    const res = await admin.put(`/api/posts/${id}`, await s.versioned(id, { title: 'Átnevezendő hír', content: doc('x'), categoryIds: ['hirek'], slug: 'atnevezett-hir' }))
    expect(res.body.post.slug).toBe('atnevezett-hir')
    expect(await resolve('/hirek/atnevezendo-hir')).toBe('/hirek/atnevezett-hir')
    // A taken slug → 409.
    const other = (await admin.post('/api/posts', { title: 'Másik hír', content: doc('x'), categoryIds: ['hirek'] })).body.post.id
    expect((await admin.put(`/api/posts/${other}`, await s.versioned(other, { title: 'Másik hír', content: doc('x'), categoryIds: ['hirek'], slug: 'atnevezett-hir' }))).status).toBe(409)
  })
})

describe('translationOf (E1)', () => {
  test('must name an existing page in the other locale: not itself, not a post, not missing → 422', async () => {
    const hu = await page('forditando')
    const post = (await admin.post('/api/posts', { title: 'Nem oldal', content: doc('x'), categoryIds: ['hirek'] })).body.post.id
    const en = (translationOf: string) => admin.post('/api/pages', { slug: `en-${crypto.randomUUID().slice(0, 6)}`, locale: 'en', title: 'x', status: 'draft', blocks: block('x'), translationOf })
    expect((await en(hu.id)).status).toBe(201)
    for (const bad of [post, '00000000-0000-4000-8000-000000000000']) expect((await en(bad)).body).toEqual({ error: 'invalid_translation' })
    // Same locale.
    const huToHu = await admin.post('/api/pages', { slug: 'hu-hu', locale: 'hu', title: 'x', status: 'draft', blocks: block('x'), translationOf: hu.id })
    expect(huToHu.body).toEqual({ error: 'invalid_translation' })
    // Itself.
    const own = await page('onmaga', 'draft', 'en')
    expect((await admin.put(`/api/pages/${own.id}`, await s.versioned(own.id, { slug: 'onmaga', title: 'x', status: 'draft', blocks: block('x'), translationOf: own.id }))).body).toEqual({ error: 'invalid_translation' })
  })
})
