/**
 * Az oldalszerkesztő (Creator) backendje - minden végpont a `pnw_manage_pages`
 * jog mögött. A nyilvános oldal ugyanezt az adatot a GET /api/public/site-on
 * keresztül olvassa (routes/public.ts): csak a kiadott oldalakat.
 */
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { RESERVED_SLUGS } from '../../shared/pnw/creator-types.ts'
import type { CreatorPageStatus, MenuItem, MenuLeaf, PageBlock, StoredCreatorPage } from '../../shared/pnw/creator-types.ts'
import { slugify } from '../../shared/pnw/slug.ts'
import { requireCapability } from '../middleware/auth.ts'
import { deletePage, existingPageSlugs, getPage, listSummaries, savePage } from '../data/pages-repo.ts'
import { clearMenu, getMenu, putMenu } from '../data/menu-repo.ts'
import { acceptUpload, listImages, storeImage, upload } from '../lib/uploads.ts'
import { sanitizeRichHtml } from '../lib/sanitize.ts'
import { logEvent } from '../lib/audit.ts'

const router = Router()

router.use(requireCapability(CAPABILITY.MANAGE_PAGES))

const MAX_BLOCKS = 200

function now(): string {
  return new Date().toISOString()
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function status(value: unknown): CreatorPageStatus {
  return value === 'publish' ? 'publish' : 'draft'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const MAX_DEPTH = 6

/** Az érték másolata, amiben minden `html` kulcsú szöveg (bármilyen mélyen) át van szűrve; túl mély szerkezetnél kivételt dob. */
function sanitizeValues(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new Error('too_deep')
  if (Array.isArray(value)) return value.map((item) => sanitizeValues(item, depth + 1))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, key === 'html' && typeof item === 'string' ? sanitizeRichHtml(item) : sanitizeValues(item, depth + 1)]),
    )
  }
  return value
}

/**
 * Az oldal blokkjai: a séma (src/pages/creatorSchema.ts) a kliensen él, ezért itt
 * csak a formát ellenőrizzük - a PageRenderer az ismeretlen komponenst úgyis kihagyja.
 */
function sanitizeBlocks(raw: unknown): PageBlock[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BLOCKS) return null
  const blocks: PageBlock[] = []
  for (const item of raw) {
    if (!isRecord(item) || typeof item.component !== 'string' || !/^[A-Za-z]{1,40}$/.test(item.component)) return null
    if (!isRecord(item.values)) return null
    let values: unknown
    try {
      values = sanitizeValues(item.values)
    } catch {
      return null
    }
    if (!isRecord(values)) return null
    const block: PageBlock = { component: item.component, values }
    if (typeof item.variant === 'string' && item.variant) block.variant = item.variant.slice(0, 40)
    blocks.push(block)
  }
  return blocks
}

/* --- média ----------------------------------------------------------------- */

router.get('/media', async (_req, res) => {
  res.json({ items: await listImages() })
})

router.post('/media', acceptUpload(upload, 'file'), async (req, res) => {
  const url = await storeImage(req.file)
  if (!url) {
    res.status(422).json({ error: 'not_an_image' })
    return
  }
  res.json({ url })
})

/* --- menü ------------------------------------------------------------------- */

/** Belső útvonal (`/valami`) vagy http(s) cím; minden más (pl. `javascript:`) kiesik. */
function safeHref(value: unknown): string | null {
  const href = text(value, 300)
  return /^(\/[^\s]*|https?:\/\/[^\s]+)$/.test(href) ? href : null
}

function sanitizeMenu(raw: unknown): MenuItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) return null
  const menu: MenuItem[] = []
  for (const item of raw) {
    if (!isRecord(item)) return null
    const label = text(item.label, 80)
    if (!label) return null
    if (Array.isArray(item.children)) {
      const children: MenuLeaf[] = []
      for (const child of item.children.slice(0, 30)) {
        const childLabel = isRecord(child) ? text(child.label, 80) : ''
        const href = isRecord(child) ? safeHref(child.href) : null
        if (!childLabel || !href) return null
        children.push({ label: childLabel, href })
      }
      menu.push({ label, children })
    } else {
      const href = safeHref(item.href)
      if (!href) return null
      menu.push({ label, href })
    }
  }
  return menu
}

router.get('/menu', async (_req, res) => {
  const stored = await getMenu()
  res.json({ menu: stored?.menu ?? null, modifiedAt: stored?.modifiedAt ?? null })
})

router.put('/menu', async (req, res) => {
  const menu = sanitizeMenu(req.body?.menu)
  if (!menu) {
    res.status(422).json({ error: 'invalid_menu' })
    return
  }
  await putMenu(menu)
  await logEvent('menu', 'menu_updated', req.pnwUser!.id, { note: `${menu.length} menüpont` })
  res.json({ menu })
})

/** "Visszaállítás az eredetire" - az oldal újra a beépített menüt használja. */
router.delete('/menu', async (req, res) => {
  await clearMenu()
  await logEvent('menu', 'menu_reset', req.pnwUser!.id)
  res.json({ ok: true })
})

/* --- oldalak ------------------------------------------------------------------ */

router.get('/', async (_req, res) => {
  res.json({ pages: await listSummaries() })
})

router.post('/', async (req, res) => {
  const title = text(req.body?.title, 200)
  const blocks = sanitizeBlocks(req.body?.blocks)
  if (!title || !blocks) {
    res.status(422).json({ error: title ? 'invalid_blocks' : 'missing_title' })
    return
  }

  // A slug a címből vagy a megadott kézi értékből lesz; foglalt (vagy már mentett) nem lehet.
  const slug = slugify(text(req.body?.slug, 80) || title)
  if (!slug || /^\d+$/.test(slug) || RESERVED_SLUGS.includes(slug)) {
    res.status(422).json({ error: 'invalid_slug' })
    return
  }
  if ((await existingPageSlugs()).has(slug)) {
    res.status(409).json({ error: 'slug_taken' })
    return
  }

  const timestamp = now()
  const page: StoredCreatorPage = {
    id: randomUUID(),
    slug,
    title,
    description: text(req.body?.description, 500),
    blocks,
    status: status(req.body?.status),
    deleted: false,
    authorId: req.pnwUser!.id,
    createdAt: timestamp,
    modifiedAt: timestamp,
    modifiedById: req.pnwUser!.id,
  }
  await savePage(page)
  await logEvent('page', 'page_created', req.pnwUser!.id, { entityId: page.id, subject: page.title, note: `/${page.slug} (${page.status === 'publish' ? 'kiadva' : 'piszkozat'})` })
  res.status(201).json({ page })
})

router.get('/:id', async (req, res) => {
  const page = await getPage(req.params.id)
  if (!page) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ page })
})

router.put('/:id', async (req, res) => {
  const existing = await getPage(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  const title = text(req.body?.title, 200)
  const blocks = sanitizeBlocks(req.body?.blocks)
  if (!title || !blocks) {
    res.status(422).json({ error: title ? 'invalid_blocks' : 'missing_title' })
    return
  }

  const page = await savePage({
    ...existing,
    title,
    description: text(req.body?.description, 500),
    blocks,
    status: status(req.body?.status),
    modifiedAt: now(),
    modifiedById: req.pnwUser!.id,
  })
  const statusNote = existing.status === page.status ? undefined : `${existing.status} → ${page.status}`
  await logEvent('page', 'page_updated', req.pnwUser!.id, { entityId: page.id, subject: page.title, note: statusNote })
  res.json({ page })
})

/** Az első DELETE a kukába teszi az oldalt (visszaállítható), a kukában lévőé végleg törli. */
router.delete('/:id', async (req, res) => {
  const page = await getPage(req.params.id)
  if (!page) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  if (page.deleted) {
    await deletePage(page.id)
    await logEvent('page', 'page_deleted', req.pnwUser!.id, { entityId: page.id, subject: page.title, note: `/${page.slug}` })
    res.json({ ok: true, permanent: true })
    return
  }
  await savePage({ ...page, deleted: true, modifiedAt: now(), modifiedById: req.pnwUser!.id })
  await logEvent('page', 'page_trashed', req.pnwUser!.id, { entityId: page.id, subject: page.title })
  res.json({ ok: true, permanent: false })
})

/** Ki a kukából - piszkozatként, hogy semmi ne kerüljön ki véletlenül. */
router.post('/:id/restore', async (req, res) => {
  const page = await getPage(req.params.id)
  if (!page) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  const restored = await savePage({ ...page, deleted: false, status: 'draft', modifiedAt: now(), modifiedById: req.pnwUser!.id })
  await logEvent('page', 'page_restored', req.pnwUser!.id, { entityId: page.id, subject: page.title })
  res.json({ page: restored })
})

export default router
