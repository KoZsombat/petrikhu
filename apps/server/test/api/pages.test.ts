import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, doc, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
beforeAll(async () => {
  s = await startTestServer({ content: true })
  admin = await s.login(DEMO.admin)
})
afterAll(() => s.close())

const title = (text = 'Új oldal') => ({ id: 'b1', type: 'pageTitle', props: { breadcrumb: [{ label: 'Kezdőlap', href: '/' }, { label: text }], title: text } })
const page = (extra: Record<string, unknown> = {}) => ({ title: 'Új oldal', blocks: [title(), { id: 'b2', type: 'richText', props: { content: doc('Szöveg') } }], ...extra })

describe('creation and slugs', () => {
  test('valid blocks → 201, slug from the title, defaults filled in by the schema', async () => {
    const res = await admin.post('/api/pages', page({ title: 'Árvíztűrő tükörfúrógép' }))
    expect(res.status).toBe(201)
    expect(res.body.page).toMatchObject({ slug: 'arvizturo-tukorfurogep', status: 'draft', locale: 'hu' })
  })

  test('manual slug; accents removed', async () => {
    expect((await admin.post('/api/pages', page({ slug: 'kezi-slug' }))).body.page.slug).toBe('kezi-slug')
    expect((await admin.post('/api/pages', page({ title: 'Ünnepi műsor' }))).body.page.slug).toBe('unnepi-musor')
  })

  test('reserved, digits-only and invalid slugs → 422; taken → 409', async () => {
    for (const slug of ['api', 'admin', 'hirek', 'kereses', 'en', 'about-us']) expect((await admin.post('/api/pages', page({ slug }))).body.error).toBe('invalid_slug')
    expect((await admin.post('/api/pages', page({ slug: '2024' }))).body.error).toBe('invalid_slug')
    expect((await admin.post('/api/pages', page({ title: '2024' }))).body.error).toBe('invalid_slug')
    expect((await admin.post('/api/pages', page({ slug: 'Nagy Betű' }))).status).toBe(422)
    expect((await admin.post('/api/pages', page({ slug: 'elerhetoseg' }))).status).toBe(409)
    expect((await admin.post('/api/pages', page({ slug: 'contact', locale: 'en' }))).status).toBe(409)
    expect((await admin.post('/api/pages', page({ slug: 'contact', locale: 'hu' }))).status).toBe(201)
  })

  test('missing title → 422', async () => {
    const res = await admin.post('/api/pages', page({ title: '' }))
    expect(res.status).toBe(422)
    expect(res.body.issues[0].message).toBe('missing_title')
  })
})

describe('block validation', () => {
  const bad = async (blocks: unknown) => (await admin.post('/api/pages', { title: `Hibás ${crypto.randomUUID().slice(0, 8)}`, blocks })).status
  test('empty, not an array, too many blocks', async () => {
    expect(await bad([])).toBe(422)
    expect(await bad('x')).toBe(422)
    expect(await bad(Array.from({ length: 201 }, (_, i) => ({ id: `b${i}`, type: 'richText', props: { content: doc('x') } })))).toBe(422)
    expect(await bad(Array.from({ length: 200 }, (_, i) => ({ id: `b${i}`, type: 'richText', props: { content: doc('x') } })))).toBe(201)
  })
  test('unknown block type or variant, missing required field, wrong type, unsafe link', async () => {
    expect(await bad([{ id: 'a', type: 'Ismeretlen', props: {} }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'cards', props: { variant: 'nincs', items: [] } }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'cta', props: { title: 'x', buttonLabel: 'y' } }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'cards', props: { variant: 'text', columns: 5, items: [] } }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'cta', props: { title: 'x', buttonLabel: 'y', href: 'javascript:alert(1)' } }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'video', props: { url: 'https://youtu.be/NnanAwvV8FI' } }])).toBe(201)
  })
  test('rich text is TipTap JSON: unknown nodes and unsafe sources are refused, unknown attributes dropped', async () => {
    expect(await bad([{ id: 'a', type: 'richText', props: { content: { type: 'doc', content: [{ type: 'script', text: 'x' }] } } }])).toBe(422)
    expect(await bad([{ id: 'a', type: 'richText', props: { content: { type: 'doc', content: [{ type: 'embed', attrs: { src: 'https://evil.example/x' } }] } } }])).toBe(422)
    const res = await admin.post('/api/pages', { title: 'Attribútum', blocks: [{ id: 'a', type: 'richText', props: { content: { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'x' }, content: [{ type: 'text', text: 'ok' }] }] } } }] })
    expect(JSON.stringify(res.body.page.blocks)).not.toContain('onclick')
  })
  test('nesting deeper than the limit → 422 (no stack overflow)', async () => {
    let node: Record<string, unknown> = { type: 'text', text: 'x' }
    for (let i = 0; i < 5000; i += 1) node = { type: 'blockquote', content: [node] }
    expect(await bad([{ id: 'a', type: 'richText', props: { content: { type: 'doc', content: [node] } } }])).toBe(422)
  })
  test('an error response says which block and which field', async () => {
    const res = await admin.post('/api/pages', { title: 'x', blocks: [title(), { id: 'c', type: 'cta', props: { title: 'x', buttonLabel: 'y' } }] })
    expect(res.body.issues[0].path).toBe('blocks.1.props.href')
  })
})

describe('publishing and trash', () => {
  test('a published page is public, a draft is not; trash hides it, restore makes it a draft, a second DELETE is permanent', async () => {
    const created = (await admin.post('/api/pages', page({ title: 'Publikus oldal', status: 'published' }))).body.page
    expect((await s.client().get('/api/public/pages/hu/publikus-oldal')).status).toBe(200)
    const draft = (await admin.post('/api/pages', page({ title: 'Rejtett oldal' }))).body.page
    expect((await s.client().get(`/api/public/pages/hu/${draft.slug}`)).status).toBe(404)
    expect((await admin.delete(`/api/pages/${created.id}`)).body).toEqual({ ok: true, permanent: false })
    expect((await s.client().get('/api/public/pages/hu/publikus-oldal')).status).toBe(404)
    expect((await admin.post(`/api/pages/${created.id}/restore`)).body.page.status).toBe('draft')
    await admin.delete(`/api/pages/${created.id}`)
    expect((await admin.delete(`/api/pages/${created.id}`)).body).toEqual({ ok: true, permanent: true })
    expect((await admin.get(`/api/pages/${created.id}`)).status).toBe(404)
  })

  test('editing a built-in page changes the public page at once', async () => {
    const list = await admin.get('/api/pages?locale=hu')
    const id = list.body.pages.find((p: { slug: string }) => p.slug === 'ebed').id
    const current = (await admin.get(`/api/pages/${id}`)).body.page
    const res = await admin.put(`/api/pages/${id}`, await s.versioned(id, { ...current, title: 'Étkezés (módosítva)', translationOf: undefined }))
    expect(res.status).toBe(200)
    expect((await s.client().get('/api/public/pages/hu/ebed')).body.page.title).toBe('Étkezés (módosítva)')
  })

  test('unknown id → 404 (GET, PUT, restore)', async () => {
    const id = crypto.randomUUID()
    expect((await admin.get(`/api/pages/${id}`)).status).toBe(404)
    expect((await admin.put(`/api/pages/${id}`, await s.versioned(id, page()))).status).toBe(404)
    expect((await admin.post(`/api/pages/${id}/restore`)).status).toBe(404)
  })
})

describe('menu', () => {
  test('a valid menu is stored and public; DELETE restores the original', async () => {
    const menu = [{ label: '  Kezdőlap ', href: '/' }, { label: 'Csoport', children: [{ label: 'Link', href: 'https://example.com' }] }, { label: 'Üres csoport', children: [] }]
    const res = await admin.put('/api/pages/menu/hu', { menu, version: (await admin.get('/api/pages/menu/hu')).body.version })
    expect(res.body.menu[0]).toEqual({ label: 'Kezdőlap', href: '/' })
    expect((await s.client().get('/api/public/site/hu')).body.menu).toHaveLength(3)
    const reset = await admin.delete('/api/pages/menu/hu')
    expect(reset.body.menu.length).toBeGreaterThan(5)
  })
  test('invalid menus → 422', async () => {
    const put = async (menu: unknown) => (await admin.put('/api/pages/menu/hu', { menu, version: (await admin.get('/api/pages/menu/hu')).body.version })).status
    expect(await put([])).toBe(422)
    expect(await put('x')).toBe(422)
    expect(await put(Array.from({ length: 31 }, () => ({ label: 'x', href: '/' })))).toBe(422)
    expect(await put([{ label: '', href: '/' }])).toBe(422)
    expect(await put([{ label: 'x', href: 'javascript:alert(1)' }])).toBe(422)
    expect(await put([{ label: 'x', href: '/van szokoz' }])).toBe(422)
    expect(await put([{ label: 'x', href: 'ftp://x' }])).toBe(422)
    expect(await put([{ label: 'x', children: [{ label: 'y' }] }])).toBe(422)
    expect((await admin.put('/api/pages/menu/de', { menu: [{ label: 'x', href: '/' }], version: 0 })).status).toBe(422)
  })
})

describe('document library', () => {
  test('valid library is public; invalid or duplicate slugs → 422; DELETE restores the original', async () => {
    const library = { categories: [{ slug: 'alap', title: 'Alap', docs: [{ slug: 'hazirend', title: 'Házirend', file: '/uploads/hazirend.pdf' }, { slug: 'vedett', title: 'Védett' }] }] }
    expect((await admin.put('/api/library', { library, version: (await admin.get('/api/library')).body.version })).status).toBe(200)
    expect((await s.client().get('/api/public/site/hu')).body.library).toEqual(library)
    expect((await admin.put('/api/library', { library: { categories: [{ slug: 'Rossz Slug', title: 'x', docs: [] }] }, version: 1 })).status).toBe(422)
    expect((await admin.put('/api/library', { library: { categories: [{ slug: 'a', title: 'x', docs: [{ slug: 'a', title: 'y' }, { slug: 'a', title: 'z' }] }] }, version: 1 })).status).toBe(422)
    expect((await admin.put('/api/library', { library: { categories: [{ slug: 'a', title: 'x', docs: [{ slug: 'b', title: 'y', file: 'javascript:x' }] }] }, version: 1 })).status).toBe(422)
    expect((await admin.delete('/api/library')).body.library.categories.length).toBeGreaterThan(3)
  })
})

describe('audit', () => {
  test('page, menu, library and account actions are logged and filterable', async () => {
    await admin.put('/api/pages/menu/en', { menu: [{ label: 'Home', href: '/en' }], version: (await admin.get('/api/pages/menu/en')).body.version })
    await admin.post('/api/users', { username: 'naplo', displayName: 'Napló', role: 'author', password: 'NaploJelszo123' })
    const all = await admin.get('/api/audit?limit=200')
    const actions = all.body.entries.map((e: { action: string }) => e.action)
    for (const action of ['page_created', 'page_trashed', 'page_restored', 'page_deleted', 'page_updated', 'menu_updated', 'menu_reset', 'library_updated', 'library_reset', 'user_created']) expect(actions).toContain(action)
    const menuOnly = await admin.get('/api/audit?entityType=menu')
    expect(menuOnly.body.entries.every((e: { entityType: string }) => e.entityType === 'menu')).toBe(true)
    expect(all.body.entries[0].userName).toBe('Szabó Éva')
  })
})
