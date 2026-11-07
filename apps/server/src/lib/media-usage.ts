/**
 * Where an uploaded or imported file is used: pages and posts (blocks, TipTap content, cover image), the menus,
 * the document library and any other site setting. A file in use cannot be deleted (routes/media.ts), and the
 * media library's cleanup view lists the uploads used nowhere.
 */
import { and, eq, like, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents, media, settings, users } from '../db/schema.ts'

export type MediaUsage =
  | { kind: 'page' | 'post'; id: string; title: string; locale: string; status: string }
  | { kind: 'menu'; locale: string }
  | { kind: 'library' }
  | { kind: 'setting'; key: string }

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&')

/** A path as a whole JSON string value, or followed by a query / fragment (`"/uploads/a.png?w=480"`). */
function jsonValueMatch(column: unknown, path: string) {
  const p = escapeLike(path)
  return or(...['"', '?', '#'].map((end) => sql`${column}::text LIKE ${`%"${p}${end}%`} ESCAPE '\\'`))!
}

export async function usagesOf(db: Db, path: string): Promise<MediaUsage[]> {
  const [docs, stored] = await Promise.all([
    db
      .select({ id: documents.id, type: documents.type, title: documents.title, locale: documents.locale, status: documents.status })
      .from(documents)
      .where(or(eq(documents.featuredImage, path), jsonValueMatch(documents.blocks, path)))
      .orderBy(documents.type, documents.title),
    db.select({ key: settings.key }).from(settings).where(jsonValueMatch(settings.value, path)),
  ])
  const out: MediaUsage[] = docs.map((d) => ({ kind: d.type, id: d.id, title: d.title, locale: d.locale, status: d.status }))
  for (const { key } of stored) {
    if (key.startsWith('menu.')) out.push({ kind: 'menu', locale: key.slice(5) })
    else if (key === 'library') out.push({ kind: 'library' })
    else out.push({ kind: 'setting', key })
  }
  return out
}

const UPLOAD_PATH = /\/uploads\/[^"'?#\s\\<>()]+/g

/** Every /uploads/ path mentioned anywhere in the content and settings (one pass over the text). */
async function referencedUploads(db: Db): Promise<Set<string>> {
  const found = new Set<string>()
  const scan = (text: string | null) => {
    for (const match of text?.matchAll(UPLOAD_PATH) ?? []) found.add(match[0])
  }
  const rows = await db.select({ blocks: sql<string>`${documents.blocks}::text`, featured: documents.featuredImage }).from(documents).where(sql`${documents.blocks}::text LIKE '%/uploads/%' OR ${documents.featuredImage} LIKE '/uploads/%'`)
  for (const row of rows) {
    scan(row.blocks)
    scan(row.featured)
  }
  for (const row of await db.select({ value: sql<string>`${settings.value}::text` }).from(settings)) scan(row.value)
  return found
}

/** Uploads (images and documents) that nothing refers to, newest first. */
export async function unusedUploads(db: Db) {
  const used = await referencedUploads(db)
  const rows = await db
    .select({ id: media.id, path: media.path, mime: media.mime, size: media.size, createdAt: media.createdAt, uploadedBy: users.name })
    .from(media)
    .leftJoin(users, eq(users.id, media.createdById))
    .where(like(media.path, '/uploads/%'))
    .orderBy(sql`${media.createdAt} DESC`)
  return rows.filter((row) => !used.has(row.path)).map((row) => ({ ...row, url: row.path, createdAt: row.createdAt.toISOString() }))
}

/** Uploaded documents (everything that is not an image), newest first, with the uploader's name. */
export async function listDocuments(db: Db, limit: number, offset: number) {
  const rows = await db
    .select({ id: media.id, path: media.path, mime: media.mime, size: media.size, createdAt: media.createdAt, uploadedBy: users.name })
    .from(media)
    .leftJoin(users, eq(users.id, media.createdById))
    .where(and(like(media.path, '/uploads/%'), sql`${media.mime} NOT LIKE 'image/%'`))
    .orderBy(sql`${media.createdAt} DESC`, media.id)
    .limit(limit)
    .offset(offset)
  return rows.map((row) => ({ ...row, url: row.path, name: row.path.slice('/uploads/'.length), createdAt: row.createdAt.toISOString() }))
}
