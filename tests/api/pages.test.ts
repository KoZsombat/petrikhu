// Creator pages CRUD + trash, menu, library - through the HTTP API (sanitizeBlocks/sanitizeMenu are private).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'

let server: TestServer
let editor: Client
let anon: Client

before(async () => {
  server = await startTestServer()
  editor = await server.login(DEMO.reviewer)
  anon = server.client()
})
after(() => server.close())

const okBlocks = () => [{ component: 'PageTitle', values: { breadcrumb: [], title: 'Cím' } }]
type Page = { id: string; slug: string; status: string; blocks: { component: string; variant?: string; values: Record<string, unknown> }[] }
let counter = 0
const uniqueTitle = () => `Teszt oldal ${++counter} ${Math.random().toString(36).slice(2, 8)}`

async function create(extra: Record<string, unknown> = {}) {
  return editor.post('/api/pages', { title: uniqueTitle(), blocks: okBlocks(), ...extra })
}
const pageOf = (res: { body: unknown }) => (res.body as { page: Page }).page
const errorOf = (res: { body: unknown }) => (res.body as { error: string }).error
type Site = { pages: { slug: string }[]; menu: unknown; library: unknown }
const site = async () => (await anon.get('/api/public/site')).body as Site

describe('creation', () => {
  test('valid blocks → 201, the slug comes from the title', async () => {
    const res = await editor.post('/api/pages', { title: 'Árvíztűrő Tükörfúrógép', blocks: okBlocks() })
    assert.equal(res.status, 201)
    const page = pageOf(res)
    assert.equal(page.slug, 'arvizturo-tukorfurogep')
    assert.equal(page.status, 'draft')
  })

  test('manual slug', async () => {
    const res = await create({ slug: 'kezi-slug-teszt' })
    assert.equal(res.status, 201)
    assert.equal(pageOf(res).slug, 'kezi-slug-teszt')
  })

  for (const slug of ['about-us', 'creator', 'api']) {
    test(`foglalt slug (${slug}) → 422 invalid_slug`, async () => {
      const res = await create({ slug })
      assert.equal(res.status, 422)
      assert.equal(errorOf(res), 'invalid_slug')
    })
  }

  test('slug of digits only → 422 invalid_slug', async () => {
    const res = await create({ slug: '12345' })
    assert.equal(res.status, 422)
    assert.equal(errorOf(res), 'invalid_slug')
  })

  test('title of digits only → 422 invalid_slug', async () => {
    const res = await editor.post('/api/pages', { title: '2026', blocks: okBlocks() })
    assert.equal(res.status, 422)
    assert.equal(errorOf(res), 'invalid_slug')
  })

  test('manual slug with accents is stored unaccented', async () => {
    const res = await create({ slug: 'Éves Terv' })
    assert.equal(pageOf(res).slug, 'eves-terv')
  })

  test('existing slug → 409 slug_taken', async () => {
    assert.equal((await create({ slug: 'dupla' })).status, 201)
    const res = await create({ slug: 'dupla' })
    assert.equal(res.status, 409)
    assert.equal(errorOf(res), 'slug_taken')
  })

  test('missing title → 422 missing_title', async () => {
    for (const title of [undefined, '', '   ']) {
      const res = await editor.post('/api/pages', { title, blocks: okBlocks() })
      assert.equal(res.status, 422)
      assert.equal(errorOf(res), 'missing_title')
    }
  })

  test('without login and without the right: 403 too', async () => {
    assert.equal((await anon.post('/api/pages', { title: 'x', blocks: okBlocks() })).status, 403)
    const author = await server.login(DEMO.author)
    assert.equal((await author.post('/api/pages', { title: 'x', blocks: okBlocks() })).status, 403)
  })
})

describe('block validation', () => {
  const invalid = async (blocks: unknown) => {
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks })
    assert.equal(res.status, 422, res.text)
    assert.equal(errorOf(res), 'invalid_blocks')
  }

  test('empty array', () => invalid([]))
  test('not an array', async () => {
    await invalid({ component: 'PageTitle', values: {} })
    await invalid('szöveg')
    await invalid(undefined)
  })
  test('more than 200 blocks', () => invalid(Array.from({ length: 201 }, () => okBlocks()[0])))
  test('exactly 200 blocks is still fine', async () => {
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: Array.from({ length: 200 }, () => okBlocks()[0]) })
    assert.equal(res.status, 201)
  })
  test('component name not letters / too long / not text / missing', async () => {
    await invalid([{ component: 'Page Title', values: {} }])
    await invalid([{ component: 'Page1', values: {} }])
    await invalid([{ component: '', values: {} }])
    await invalid([{ component: 'A'.repeat(41), values: {} }])
    await invalid([{ component: 5, values: {} }])
    await invalid([{ values: {} }])
  })
  test('shape-valid but unknown component → 422 invalid_fields', async () => {
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: [{ component: 'A'.repeat(40), values: {} }] })
    assert.equal(res.status, 422)
    assert.equal(errorOf(res), 'invalid_fields')
    assert.match(JSON.stringify(res.body), /unknown component/)
  })
  test('values not an object', async () => {
    await invalid([{ component: 'PageTitle', values: 'x' }])
    await invalid([{ component: 'PageTitle', values: [] }])
    await invalid([{ component: 'PageTitle', values: null }])
    await invalid([{ component: 'PageTitle' }])
  })
  test('the block itself is not an object', async () => {
    await invalid([null])
    await invalid(['PageTitle'])
    await invalid([[]])
  })

  /** `levels` levels of nesting in values (values itself is level 0). */
  const nested = (levels: number) => {
    let inner: unknown = 'levél'
    for (let i = 0; i < levels; i++) inner = { k: inner }
    return inner as Record<string, unknown>
  }
  test('nesting deeper than 7 levels → 422', async () => {
    await invalid([{ component: 'PageTitle', values: nested(8) }])
  })
  test('6 levels of nesting pass the shape check, but the field is unknown in the schema → invalid_fields', async () => {
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: [{ component: 'PageTitle', values: nested(6) }] })
    assert.equal(errorOf(res), 'invalid_fields')
  })

  test('the html key is filtered at any depth', async () => {
    const res = await editor.post('/api/pages', {
      title: uniqueTitle(),
      blocks: [
        { component: 'RichText', values: { html: '<p onclick="x()">Jó</p><script>alert(1)</script>' } },
        { component: 'Accordion', values: { items: [{ title: 'T', html: '<a href="javascript:alert(1)">l</a><b>fet</b>' }] } },
      ],
    })
    assert.equal(res.status, 201)
    const stored = pageOf(await editor.get(`/api/pages/${pageOf(res).id}`))
    assert.equal(stored.blocks[0].values.html, '<p>Jó</p>')
    const item = (stored.blocks[1].values.items as { html: string }[])[0]
    assert.ok(!item.html.includes('javascript') && item.html.includes('<b>fet</b>'), item.html)
    const row = await server.sql<{ blocks: string }>('SELECT blocks FROM creator_pages WHERE id = $1', [stored.id])
    assert.ok(!String(row[0].blocks).includes('<script'))
  })

  test('text under a non-html key stays untouched', async () => {
    const res = await editor.post('/api/pages', {
      title: uniqueTitle(),
      blocks: [{ component: 'PageTitle', values: { breadcrumb: [], title: '<script>x</script>' } }],
    })
    assert.equal(pageOf(res).blocks[0].values.title, '<script>x</script>')
  })

  test('unknown or missing variant → invalid_fields, known variant → 201', async () => {
    for (const variant of ['v'.repeat(60), '', 7]) {
      const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: [{ component: 'CardGrid', variant, values: { items: [{ title: 'A' }] } }] })
      assert.equal(errorOf(res), 'invalid_fields', String(variant))
    }
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: [{ component: 'CardGrid', variant: 'text', values: { items: [{ title: 'A' }] } }] })
    assert.equal(res.status, 201, res.text)
    assert.equal(pageOf(res).blocks[0].variant, 'text')
  })

  test('a field error response says which block and which field', async () => {
    const res = await editor.post('/api/pages', { title: uniqueTitle(), blocks: [...okBlocks(), { component: 'CardGrid', variant: 'text', values: { items: [{ title: 'A', href: 'javascript:x' }] } }] })
    assert.equal(res.status, 422)
    assert.deepEqual((res.body as { issues: unknown[] }).issues, [{ block: 1, path: 'items.0.href', message: 'unsafe link' }])
  })

  test('the filtering also applies on update (PUT)', async () => {
    const page = pageOf(await create())
    const bad = await editor.put(`/api/pages/${page.id}`, { title: 'x', blocks: [] })
    assert.equal(bad.status, 422)
    assert.equal(errorOf(bad), 'invalid_blocks')
    const ok = await editor.put(`/api/pages/${page.id}`, { title: 'Új', status: 'publish', blocks: [{ component: 'RichText', values: { html: '<script>x</script><p>a</p>' } }] })
    assert.equal(ok.status, 200)
    assert.equal(pageOf(ok).blocks[0].values.html, '<p>a</p>')
    assert.equal(pageOf(ok).slug, page.slug)
  })
})

describe('publishing, trash', () => {
  test('the published page is visible at /site and /pages/:slug, the draft is not', async () => {
    const pub = pageOf(await create({ status: 'publish' }))
    const draft = pageOf(await create())

    const s = await site()
    assert.ok(s.pages.some((p) => p.slug === pub.slug))
    assert.ok(!s.pages.some((p) => p.slug === draft.slug))

    const one = await anon.get(`/api/public/pages/${pub.slug}`)
    assert.equal(one.status, 200)
    assert.equal((one.body as { page: { slug: string } }).page.slug, pub.slug)
    assert.equal((await anon.get(`/api/public/pages/${draft.slug}`)).status, 404)
    assert.equal((await anon.get('/api/public/pages/nincs-ilyen')).status, 404)
  })

  test('trashing: it disappears, after restore it is a draft; a second DELETE is permanent', async () => {
    const page = pageOf(await create({ status: 'publish' }))

    const trashed = await editor.delete(`/api/pages/${page.id}`)
    assert.deepEqual(trashed.body, { ok: true, permanent: false })
    assert.ok(!(await site()).pages.some((p) => p.slug === page.slug))
    assert.equal((await anon.get(`/api/public/pages/${page.slug}`)).status, 404)
    // an item still in the trash is retrievable by the editor
    assert.equal((await editor.get(`/api/pages/${page.id}`)).status, 200)

    const restored = await editor.post(`/api/pages/${page.id}/restore`)
    assert.equal(restored.status, 200)
    assert.equal(pageOf(restored).status, 'draft')
    assert.ok(!(await site()).pages.some((p) => p.slug === page.slug))

    assert.deepEqual((await editor.delete(`/api/pages/${page.id}`)).body, { ok: true, permanent: false })
    const gone = await editor.delete(`/api/pages/${page.id}`)
    assert.deepEqual(gone.body, { ok: true, permanent: true })
    assert.equal((await editor.get(`/api/pages/${page.id}`)).status, 404)
    assert.equal((await editor.delete(`/api/pages/${page.id}`)).status, 404)
  })

  test('unknown id → 404 (GET, PUT, restore)', async () => {
    assert.equal((await editor.get('/api/pages/nincs')).status, 404)
    assert.equal((await editor.put('/api/pages/nincs', { title: 'x', blocks: okBlocks() })).status, 404)
    assert.equal((await editor.post('/api/pages/nincs/restore')).status, 404)
  })
})

describe('menu', () => {
  const invalid = async (menu: unknown) => {
    const res = await editor.put('/api/pages/menu', { menu })
    assert.equal(res.status, 422, res.text)
    assert.equal(errorOf(res), 'invalid_menu')
  }

  test('a valid menu is stored and visible in /site', async () => {
    const menu = [
      { label: 'Hírek', href: '/hirek' },
      { label: 'Külső', href: 'https://example.com/x?y=1' },
      { label: 'Szakmák', children: [{ label: 'Vegyipar', href: '/vegyipar-agazat' }, { label: 'Ext', href: 'http://a.hu' }] },
    ]
    const res = await editor.put('/api/pages/menu', { menu })
    assert.equal(res.status, 200)
    assert.deepEqual((res.body as { menu: unknown }).menu, menu)
    assert.deepEqual(((await editor.get('/api/pages/menu')).body as { menu: unknown }).menu, menu)
    assert.deepEqual((await site()).menu, menu)
  })

  test('the label and href are trimmed / filtered', async () => {
    const res = await editor.put('/api/pages/menu', { menu: [{ label: '  Elöl  ', href: '/a', extra: 'x' }] })
    assert.deepEqual((res.body as { menu: unknown }).menu, [{ label: 'Elöl', href: '/a' }])
  })

  test('empty array / not an array / missing menu', async () => {
    await invalid([])
    await invalid('x')
    await invalid({ label: 'a', href: '/a' })
    await invalid(undefined)
  })
  test('more than 30 items', async () => {
    await invalid(Array.from({ length: 31 }, (_, i) => ({ label: `E${i}`, href: '/x' })))
    const ok = await editor.put('/api/pages/menu', { menu: Array.from({ length: 30 }, (_, i) => ({ label: `E${i}`, href: '/x' })) })
    assert.equal(ok.status, 200)
  })
  test('missing or empty label', async () => {
    await invalid([{ href: '/x' }])
    await invalid([{ label: '   ', href: '/x' }])
    await invalid([{ label: 5, href: '/x' }])
  })
  test('item not an object', async () => {
    await invalid(['x'])
    await invalid([null])
  })
  test('javascript: href', async () => {
    await invalid([{ label: 'a', href: 'javascript:alert(1)' }])
    await invalid([{ label: 'a', children: [{ label: 'b', href: 'javascript:alert(1)' }] }])
  })
  test('href containing a space', async () => {
    await invalid([{ label: 'a', href: '/a b' }])
    await invalid([{ label: 'a', href: 'https://a.hu/a b' }])
  })
  test('missing href and other schemes', async () => {
    await invalid([{ label: 'a' }])
    await invalid([{ label: 'a', href: '' }])
    await invalid([{ label: 'a', href: 'hirek' }])
    await invalid([{ label: 'a', href: 'mailto:a@b.hu' }])
    await invalid([{ label: 'a', href: 'ftp://a.hu/x' }])
  })
  test('child without href / bad child', async () => {
    await invalid([{ label: 'a', children: [{ label: 'b' }] }])
    await invalid([{ label: 'a', children: [{ href: '/x' }] }])
    await invalid([{ label: 'a', children: ['x'] }])
  })
  test('an empty children array is still valid (a group without a submenu)', async () => {
    const res = await editor.put('/api/pages/menu', { menu: [{ label: 'a', children: [] }] })
    assert.equal(res.status, 200)
  })

  test('DELETE restores it (null)', async () => {
    await editor.put('/api/pages/menu', { menu: [{ label: 'a', href: '/a' }] })
    const del = await editor.delete('/api/pages/menu')
    assert.deepEqual(del.body, { ok: true })
    assert.equal(((await editor.get('/api/pages/menu')).body as { menu: unknown }).menu, null)
    assert.equal((await site()).menu, null)
  })
})

describe('document library', () => {
  const library = {
    categories: [
      {
        slug: 'szabalyzatok',
        title: 'Szabályzatok',
        docs: [
          { slug: 'hazirend', title: 'Házirend', file: '/uploads/hazirend-abc123.pdf' },
          { slug: 'kulso', title: 'Külső', file: 'https://example.com/a.pdf' },
          { slug: 'fajl-nelkul', title: 'Fájl nélkül' },
        ],
      },
    ],
  }
  const invalid = async (value: unknown) => {
    const res = await editor.put('/api/pages/library', { library: value })
    assert.equal(res.status, 422, res.text)
    assert.equal(errorOf(res), 'invalid_library')
  }

  test('a valid library shows in /site', async () => {
    const res = await editor.put('/api/pages/library', { library })
    assert.equal(res.status, 200)
    assert.deepEqual((await site()).library, library)
    assert.deepEqual(((await editor.get('/api/pages/library')).body as { library: unknown }).library, library)
  })

  test('invalid library → 422', async () => {
    await invalid(undefined)
    await invalid('x')
    await invalid({})
    await invalid({ categories: 'x' })
    await invalid({ categories: [{ slug: 'Rossz Slug', title: 'T', docs: [] }] })
    await invalid({ categories: [{ slug: 'a', title: '  ', docs: [] }] })
    await invalid({ categories: [{ slug: 'a', title: 'T', docs: [{ slug: 'd', title: '' }] }] })
    await invalid({ categories: [{ slug: 'a', title: 'T', docs: [{ slug: 'd', title: 'D', file: 'javascript:alert(1)' }] }] })
    await invalid({ categories: [{ slug: 'a', title: 'T', docs: [{ slug: 'd', title: 'D', file: '//evil.hu/x.pdf' }] }] })
  })

  test('duplicate slug (category or document) → 422', async () => {
    await invalid({ categories: [{ slug: 'a', title: 'A', docs: [] }, { slug: 'a', title: 'B', docs: [] }] })
    await invalid({ categories: [{ slug: 'a', title: 'A', docs: [{ slug: 'd', title: 'D' }, { slug: 'd', title: 'E' }] }] })
    await invalid({ categories: [{ slug: 'a', title: 'A', docs: [{ slug: 'd', title: 'D' }] }, { slug: 'b', title: 'B', docs: [{ slug: 'd', title: 'E' }] }] })
  })

  test('DELETE removes it', async () => {
    await editor.put('/api/pages/library', { library })
    assert.deepEqual((await editor.delete('/api/pages/library')).body, { ok: true })
    assert.equal((await site()).library, null)
  })

  test('the author (without the right) cannot reach it', async () => {
    const author = await server.login(DEMO.author)
    assert.equal((await author.put('/api/pages/library', { library })).status, 403)
  })
})
