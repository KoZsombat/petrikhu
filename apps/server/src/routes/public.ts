/**
 * The public site's API (read by the Next.js server). Every response is built from the `toPublic*` DTOs:
 * only the fields listed there ever leave this file. Cached by browsers / proxies for a minute.
 */
import { Hono } from 'hono'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '../db/client.ts'
import { localeSchema } from '@petrik/shared/schemas'
import type { Library, Menu, PublicSitemap, PublicSite } from '@petrik/shared/schemas'
import type { AppEnv } from '../context.ts'
import { documents, documentTerms } from '../db/schema.ts'
import { categoryNamesOf, categoryWithChildren, countSql, findBySlug, likePattern, toPublicPage, toPublicPost, toPublicPostSummary } from '../lib/documents.ts'
import { defaultLibrary, defaultMenu, getSetting } from '../lib/seed.ts'

const routes = new Hono<AppEnv>()

routes.use(async (c, next) => {
  await next()
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=60')
})

const published = and(eq(documents.status, 'published'))

async function translationPairs(db: Db): Promise<{ hu: string; en: string }[]> {
  const hu = alias(documents, 'hu')
  return db
    .select({ hu: hu.slug, en: documents.slug })
    .from(documents)
    .innerJoin(hu, eq(hu.id, documents.translationOf))
    .where(and(eq(documents.type, 'page'), eq(documents.locale, 'en'), eq(documents.status, 'published'), eq(hu.status, 'published')))
}

routes.get('/site/:locale', async (c) => {
  const locale = localeSchema.safeParse(c.req.param('locale'))
  if (!locale.success) return c.json({ error: 'not_found' }, 404)
  const body: PublicSite = {
    menu: (await getSetting<Menu>(c.var.db, `menu.${locale.data}`)) ?? (await defaultMenu(locale.data)),
    library: (await getSetting<Library>(c.var.db, 'library')) ?? (await defaultLibrary()),
    translations: await translationPairs(c.var.db),
  }
  return c.json(body)
})

routes.get('/pages/:locale/:slug', async (c) => {
  const locale = localeSchema.safeParse(c.req.param('locale'))
  if (!locale.success) return c.json({ error: 'not_found' }, 404)
  const row = await findBySlug(c.var.db, 'page', locale.data, c.req.param('slug'))
  if (!row || row.status !== 'published') return c.json({ error: 'not_found' }, 404)
  // The other language's version: an English page points at its Hungarian original, a Hungarian page is pointed at.
  const other = row.translationOf
    ? (await c.var.db.select().from(documents).where(eq(documents.id, row.translationOf)).limit(1))[0]
    : (await c.var.db.select().from(documents).where(and(eq(documents.translationOf, row.id), eq(documents.type, 'page'))).limit(1))[0]
  const alternate = other && other.status === 'published' ? { locale: other.locale as 'hu' | 'en', slug: other.slug } : null
  return c.json({ page: toPublicPage(row, alternate) })
})

/** `?limit=&offset=&category=<name>&q=` - published posts, newest first, without their content. */
routes.get('/posts', async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 10))
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)
  const category = (c.req.query('category') ?? '').trim()
  const q = (c.req.query('q') ?? '').trim().slice(0, 200)
  let inCategory = undefined
  if (category) {
    const ids = await categoryWithChildren(c.var.db, category)
    if (!ids) return c.json({ posts: [], total: 0 })
    inCategory = inArray(documents.id, c.var.db.select({ id: documentTerms.documentId }).from(documentTerms).where(inArray(documentTerms.termId, ids)))
  }
  const where = and(eq(documents.type, 'post'), published, inCategory, q ? sql`${documents.searchText} LIKE ${likePattern(q)} ESCAPE '\\'` : undefined)
  const [rows, [{ total }]] = await Promise.all([
    c.var.db.select().from(documents).where(where).orderBy(desc(documents.publishedAt), desc(documents.id)).limit(limit).offset(offset),
    c.var.db.select({ total: countSql }).from(documents).where(where),
  ])
  const names = await categoryNamesOf(c.var.db, rows.map((r) => r.id))
  return c.json({ posts: rows.map((row) => toPublicPostSummary(row, names.get(row.id) ?? [])), total })
})

routes.get('/posts/:slug', async (c) => {
  const row = await findBySlug(c.var.db, 'post', 'hu', c.req.param('slug'))
  if (!row || row.status !== 'published') return c.json({ error: 'not_found' }, 404)
  const names = await categoryNamesOf(c.var.db, [row.id])
  return c.json({ post: toPublicPost(row, names.get(row.id) ?? []) })
})

/** Everything the sitemap lists: published pages (with their translation) and published posts, slugs and dates only. */
routes.get('/sitemap', async (c) => {
  const db = c.var.db
  const [pageRows, postRows, pairs] = await Promise.all([
    db.select({ locale: documents.locale, slug: documents.slug, updatedAt: documents.updatedAt }).from(documents).where(and(eq(documents.type, 'page'), published)),
    db.select({ slug: documents.slug, updatedAt: documents.updatedAt }).from(documents).where(and(eq(documents.type, 'post'), published)).orderBy(desc(documents.publishedAt)),
    translationPairs(db),
  ])
  const body: PublicSitemap = {
    pages: pageRows.map((p) => ({ locale: p.locale, slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    posts: postRows.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    translations: pairs,
  }
  return c.json(body)
})

/**
 * Old news URLs lived at `/<slug>`. When no published page has that slug but a published post does, the site
 * redirects (301) to `/hirek/<slug>`.
 */
routes.get('/resolve/:slug', async (c) => {
  const slug = c.req.param('slug')
  const page = await findBySlug(c.var.db, 'page', 'hu', slug)
  if (page?.status === 'published') return c.json({ kind: 'page' })
  const post = await findBySlug(c.var.db, 'post', 'hu', slug)
  if (post?.status === 'published') return c.json({ kind: 'post', redirect: `/hirek/${post.slug}` })
  return c.json({ kind: 'none' }, 404)
})

export default routes
