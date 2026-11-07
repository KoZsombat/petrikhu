/** The Creator: pages (both locales) and the menus. Everything needs `pages.manage`. */
import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { localeSchema, menuSchema, pageSaveBody, pagesQuery } from '@petrik/shared/schemas'
import type { Locale } from '@petrik/shared/schemas'
import { isReservedSlug, slugify } from '@petrik/shared/slug'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import type { Db } from '../db/client.ts'
import { documents } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { findDocument, searchTextOf, toPage, toPageSummary } from '../lib/documents.ts'
import { defaultMenu, getSetting, putSetting } from '../lib/seed.ts'
import { validate } from '../lib/validate.ts'

const pages = new Hono<AppEnv>()
pages.use(requireCap('pages.manage'))

/* --- menus ------------------------------------------------------------------------------------------- */

const localeParam = z.object({ locale: localeSchema })

pages.get('/menu/:locale', validate('param', localeParam), async (c) => {
  const { locale } = c.req.valid('param')
  const stored = await getSetting(c.var.db, `menu.${locale}`)
  return c.json({ menu: stored ?? (await defaultMenu(locale)), custom: stored !== undefined })
})

pages.put('/menu/:locale', validate('param', localeParam), validate('json', z.object({ menu: menuSchema })), async (c) => {
  const { locale } = c.req.valid('param')
  const { menu } = c.req.valid('json')
  const user = userOf(c)
  await putSetting(c.var.db, `menu.${locale}`, menu, user.id)
  await logAudit(c.var.db, { entityType: 'menu', entityId: locale, subject: `Menü (${locale})`, action: 'menu_updated', note: `${menu.length} menüpont`, userId: user.id })
  return c.json({ menu })
})

/** Back to the original (seed) menu. */
pages.delete('/menu/:locale', validate('param', localeParam), async (c) => {
  const { locale } = c.req.valid('param')
  const user = userOf(c)
  const menu = await defaultMenu(locale)
  await putSetting(c.var.db, `menu.${locale}`, menu, user.id)
  await logAudit(c.var.db, { entityType: 'menu', entityId: locale, subject: `Menü (${locale})`, action: 'menu_reset', userId: user.id })
  return c.json({ menu })
})

/* --- pages ---------------------------------------------------------------------------------------------- */

const isPage = eq(documents.type, 'page')

async function loadPage(db: Db, id: string) {
  const row = await findDocument(db, id)
  return row?.type === 'page' ? row : undefined
}

pages.get('/', validate('query', pagesQuery), async (c) => {
  const { locale } = c.req.valid('query')
  const rows = await c.var.db.select().from(documents).where(and(isPage, locale ? eq(documents.locale, locale) : undefined)).orderBy(asc(documents.locale), asc(documents.title))
  return c.json({ pages: rows.map(toPageSummary) })
})

pages.get('/:id', async (c) => {
  const row = await loadPage(c.var.db, c.req.param('id'))
  return row ? c.json({ page: toPage(row) }) : c.json({ error: 'not_found' }, 404)
})

/** A slug from the given value or the title; reserved, digits-only or taken ones are refused. */
async function checkSlug(db: Db, raw: string | undefined, title: string, locale: Locale, exceptId?: string) {
  const slug = slugify(raw || title, '')
  if (!slug || /^\d+$/.test(slug) || isReservedSlug(slug)) return { error: 'invalid_slug' as const, status: 422 as const }
  const clash = (await db.select({ id: documents.id }).from(documents).where(and(isPage, eq(documents.locale, locale), eq(documents.slug, slug))).limit(1))[0]
  if (clash && clash.id !== exceptId) return { error: 'slug_taken' as const, status: 409 as const }
  return { slug }
}

pages.post('/', validate('json', pageSaveBody), async (c) => {
  const user = userOf(c)
  const body = c.req.valid('json')
  const checked = await checkSlug(c.var.db, body.slug || undefined, body.title, body.locale)
  if ('error' in checked) return c.json({ error: checked.error }, checked.status)
  const now = new Date()
  const [row] = await c.var.db
    .insert(documents)
    .values({
      type: 'page',
      slug: checked.slug,
      locale: body.locale,
      title: body.title,
      description: body.description,
      blocks: body.blocks,
      status: body.status,
      translationOf: body.translationOf ?? null,
      authorId: user.id,
      updatedById: user.id,
      publishedAt: body.status === 'published' ? now : null,
      searchText: searchTextOf(body.title, body.blocks),
    })
    .returning()
  await logAudit(c.var.db, { entityType: 'page', entityId: row.id, subject: row.title, action: 'page_created', toStatus: row.status, note: `/${row.locale === 'en' ? 'en/' : ''}${row.slug}`, userId: user.id })
  return c.json({ page: toPage(row) }, 201)
})

pages.put('/:id', validate('json', pageSaveBody), async (c) => {
  const user = userOf(c)
  const existing = await loadPage(c.var.db, c.req.param('id'))
  if (!existing) return c.json({ error: 'not_found' }, 404)
  if (existing.status === 'trash') return c.json({ error: 'in_trash' }, 409)
  const body = c.req.valid('json')
  const checked = await checkSlug(c.var.db, body.slug || existing.slug, body.title, existing.locale as Locale, existing.id)
  if ('error' in checked) return c.json({ error: checked.error }, checked.status)
  const [row] = await c.var.db
    .update(documents)
    .set({
      slug: checked.slug,
      title: body.title,
      description: body.description,
      blocks: body.blocks,
      status: body.status,
      translationOf: body.translationOf ?? null,
      updatedById: user.id,
      updatedAt: new Date(),
      publishedAt: body.status === 'published' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      searchText: searchTextOf(body.title, body.blocks),
    })
    .where(eq(documents.id, existing.id))
    .returning()
  const note = [existing.status !== row.status ? `${existing.status} → ${row.status}` : '', existing.slug !== row.slug ? `/${existing.slug} → /${row.slug}` : ''].filter(Boolean).join('\n')
  await logAudit(c.var.db, { entityType: 'page', entityId: row.id, subject: row.title, action: 'page_updated', fromStatus: existing.status, toStatus: row.status, note: note || null, userId: user.id })
  return c.json({ page: toPage(row) })
})

/** First DELETE: to the trash (off the site). DELETE of a trashed page: gone for good. */
pages.delete('/:id', async (c) => {
  const user = userOf(c)
  const page = await loadPage(c.var.db, c.req.param('id'))
  if (!page) return c.json({ error: 'not_found' }, 404)
  if (page.status === 'trash') {
    await c.var.db.delete(documents).where(eq(documents.id, page.id))
    await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_deleted', fromStatus: 'trash', note: `/${page.slug}`, userId: user.id })
    return c.json({ ok: true, permanent: true })
  }
  await c.var.db.update(documents).set({ status: 'trash', updatedAt: new Date(), updatedById: user.id }).where(eq(documents.id, page.id))
  await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_trashed', fromStatus: page.status, toStatus: 'trash', userId: user.id })
  return c.json({ ok: true, permanent: false })
})

/** Restores from the trash as a draft, so nothing goes public by accident. */
pages.post('/:id/restore', async (c) => {
  const user = userOf(c)
  const page = await loadPage(c.var.db, c.req.param('id'))
  if (!page || page.status !== 'trash') return c.json({ error: 'not_found' }, 404)
  const [row] = await c.var.db.update(documents).set({ status: 'draft', updatedAt: new Date(), updatedById: user.id }).where(eq(documents.id, page.id)).returning()
  await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_restored', fromStatus: 'trash', toStatus: 'draft', userId: user.id })
  return c.json({ page: toPage(row) })
})

export default pages
