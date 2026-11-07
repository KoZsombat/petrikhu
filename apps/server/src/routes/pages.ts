/** The Creator: pages (both locales) and the menus. Everything needs `pages.manage`. */
import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { localeSchema, menuSaveBody, pageSaveBody, pagesQuery } from '@petrik/shared/schemas'
import type { Locale } from '@petrik/shared/schemas'
import { isReservedSlug, slugify } from '@petrik/shared/slug'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import type { Db } from '../db/client.ts'
import { documents } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { addRedirect, dropRedirectFrom, pagePath } from '../lib/redirects.ts'
import { pageTags, revalidateSite } from '../lib/revalidate.ts'
import { TAG } from '@petrik/shared/cache-tags'
import { findDocument, searchTextOf, toPage, toPageSummary } from '../lib/documents.ts'
import { defaultMenu, getVersionedSetting, putSetting, putSettingIfVersion } from '../lib/seed.ts'
import { conflictBody } from '../lib/conflict.ts'
import { validate } from '../lib/validate.ts'

const pages = new Hono<AppEnv>()
pages.use(requireCap('pages.manage'))

/* --- menus ------------------------------------------------------------------------------------------- */

const localeParam = z.object({ locale: localeSchema })

pages.get('/menu/:locale', validate('param', localeParam), async (c) => {
  const { locale } = c.req.valid('param')
  const stored = await getVersionedSetting(c.var.db, `menu.${locale}`)
  return c.json({ menu: stored.value ?? (await defaultMenu(locale)), custom: stored.value !== undefined, version: stored.version })
})

pages.put('/menu/:locale', validate('param', localeParam), validate('json', menuSaveBody), async (c) => {
  const { locale } = c.req.valid('param')
  const { menu, version: expected } = c.req.valid('json')
  const user = userOf(c)
  const version = await putSettingIfVersion(c.var.db, `menu.${locale}`, menu, user.id, expected)
  if (version === null) return c.json(await conflictBody(c.var.db, await getVersionedSetting(c.var.db, `menu.${locale}`)), 409)
  await logAudit(c.var.db, { entityType: 'menu', entityId: locale, subject: `Menü (${locale})`, action: 'menu_updated', note: `${menu.length} menüpont`, userId: user.id })
  await revalidateSite(c.var.config, [TAG.site])
  return c.json({ menu, version })
})

/** Back to the original (seed) menu. */
pages.delete('/menu/:locale', validate('param', localeParam), async (c) => {
  const { locale } = c.req.valid('param')
  const user = userOf(c)
  const menu = await defaultMenu(locale)
  await putSetting(c.var.db, `menu.${locale}`, menu, user.id)
  await logAudit(c.var.db, { entityType: 'menu', entityId: locale, subject: `Menü (${locale})`, action: 'menu_reset', userId: user.id })
  await revalidateSite(c.var.config, [TAG.site])
  return c.json({ menu, version: (await getVersionedSetting(c.var.db, `menu.${locale}`)).version })
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

/**
 * translationOf must name an existing page in the other locale (not this page, not a post): otherwise 422
 * invalid_translation instead of a foreign-key error.
 */
async function checkTranslation(db: Db, translationOf: string | null | undefined, locale: Locale, selfId?: string) {
  if (!translationOf) return true
  if (translationOf === selfId) return false
  const target = await findDocument(db, translationOf)
  return !!target && target.type === 'page' && target.locale !== locale && target.status !== 'trash'
}

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
  if (!(await checkTranslation(c.var.db, body.translationOf, body.locale))) return c.json({ error: 'invalid_translation' }, 422)
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
  if (row.status === 'published') await dropRedirectFrom(c.var.db, pagePath(row.locale, row.slug))
  if (row.status === 'published') await revalidateSite(c.var.config, pageTags(row.locale, [row.slug], true))
  await logAudit(c.var.db, { entityType: 'page', entityId: row.id, subject: row.title, action: 'page_created', toStatus: row.status, note: `/${row.locale === 'en' ? 'en/' : ''}${row.slug}`, userId: user.id })
  return c.json({ page: toPage(row) }, 201)
})

pages.put('/:id', validate('json', pageSaveBody), async (c) => {
  const user = userOf(c)
  const existing = await loadPage(c.var.db, c.req.param('id'))
  if (!existing) return c.json({ error: 'not_found' }, 404)
  if (existing.status === 'trash') return c.json({ error: 'in_trash' }, 409)
  const body = c.req.valid('json')
  if (body.version === undefined) return c.json({ error: 'version_required' }, 422)
  if (body.version !== existing.version) return c.json(await conflictBody(c.var.db, existing), 409)
  const checked = await checkSlug(c.var.db, body.slug || existing.slug, body.title, existing.locale as Locale, existing.id)
  if ('error' in checked) return c.json({ error: checked.error }, checked.status)
  if (!(await checkTranslation(c.var.db, body.translationOf, existing.locale as Locale, existing.id))) return c.json({ error: 'invalid_translation' }, 422)
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
    .where(and(eq(documents.id, existing.id), eq(documents.version, body.version)))
    .returning()
  if (!row) {
    const now = await loadPage(c.var.db, existing.id)
    return now ? c.json(await conflictBody(c.var.db, now), 409) : c.json({ error: 'not_found' }, 404)
  }
  // A published page that moves keeps its old address working (301); the new address is a real page now.
  if (existing.slug !== row.slug && existing.status === 'published') await addRedirect(c.var.db, pagePath(existing.locale, existing.slug), pagePath(row.locale, row.slug), user.id)
  if (row.status === 'published') await dropRedirectFrom(c.var.db, pagePath(row.locale, row.slug))
  const note = [existing.status !== row.status ? `${existing.status} → ${row.status}` : '', existing.slug !== row.slug ? `/${existing.slug} → /${row.slug}` : ''].filter(Boolean).join('\n')
  if (existing.status === 'published' || row.status === 'published') {
    const structural = existing.slug !== row.slug || existing.status !== row.status || existing.translationOf !== row.translationOf || existing.title !== row.title
    await revalidateSite(c.var.config, pageTags(row.locale, [existing.slug, row.slug], structural))
  }
  await logAudit(c.var.db, { entityType: 'page', entityId: row.id, subject: row.title, action: 'page_updated', fromStatus: existing.status, toStatus: row.status, note: note || null, userId: user.id })
  return c.json({ page: toPage(row) })
})

/** First DELETE: to the trash (off the site). DELETE of a trashed page: gone for good. */
pages.delete('/:id', async (c) => {
  const user = userOf(c)
  const page = await loadPage(c.var.db, c.req.param('id'))
  if (!page) return c.json({ error: 'not_found' }, 404)
  if (page.status === 'trash') {
    const gone = await c.var.db.delete(documents).where(and(eq(documents.id, page.id), eq(documents.status, 'trash'))).returning({ id: documents.id })
    if (!gone.length) return c.json({ error: 'status_changed' }, 409)
    await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_deleted', fromStatus: 'trash', note: `/${page.slug}`, userId: user.id })
    return c.json({ ok: true, permanent: true })
  }
  const trashed = await c.var.db.update(documents).set({ status: 'trash', updatedAt: new Date(), updatedById: user.id }).where(and(eq(documents.id, page.id), eq(documents.status, page.status))).returning({ id: documents.id })
  if (!trashed.length) return c.json({ error: 'status_changed' }, 409)
  if (page.status === 'published') await revalidateSite(c.var.config, pageTags(page.locale, [page.slug], true))
  await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_trashed', fromStatus: page.status, toStatus: 'trash', userId: user.id })
  return c.json({ ok: true, permanent: false })
})

/** Restores from the trash as a draft, so nothing goes public by accident. */
pages.post('/:id/restore', async (c) => {
  const user = userOf(c)
  const page = await loadPage(c.var.db, c.req.param('id'))
  if (!page || page.status !== 'trash') return c.json({ error: 'not_found' }, 404)
  const [row] = await c.var.db.update(documents).set({ status: 'draft', updatedAt: new Date(), updatedById: user.id }).where(and(eq(documents.id, page.id), eq(documents.status, 'trash'))).returning()
  if (!row) return c.json({ error: 'status_changed' }, 409)
  await logAudit(c.var.db, { entityType: 'page', entityId: page.id, subject: page.title, action: 'page_restored', fromStatus: 'trash', toStatus: 'draft', userId: user.id })
  return c.json({ page: toPage(row) })
})

export default pages
