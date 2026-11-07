/** The media library: uploaded images (with WebP / AVIF variants) and documents, usages, cleanup, delete. */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import { media } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { can } from '@petrik/shared/roles'
import { mediaLookupQuery, mediaQuery } from '@petrik/shared/schemas'
import type { Db } from '../db/client.ts'
import { listImages, mediaKey, storeImage } from '../lib/media.ts'
import { listDocuments, unusedUploads, usagesOf } from '../lib/media-usage.ts'
import { validate } from '../lib/validate.ts'
import { revalidateSite } from '../lib/revalidate.ts'
import { TAG } from '@petrik/shared/cache-tags'

/** The single `file` field of a multipart upload; null for anything else (wrong field, not multipart). */
export async function readUpload(c: Context): Promise<File | null> {
  try {
    const form = await c.req.formData()
    const file = form.get('file')
    return file instanceof File ? file : null
  } catch {
    return null
  }
}

const routes = new Hono<AppEnv>()
routes.use(requireCap('media.upload', 'pages.manage', 'library.manage'))

/** `?kind=images` (default) or `?kind=documents`, 100 per page. */
routes.get('/', validate('query', mediaQuery), async (c) => {
  const { page, kind } = c.req.valid('query')
  const user = userOf(c)
  if (kind === 'documents') {
    if (!can(user, 'library.manage') && !can(user, 'pages.manage')) return c.json({ error: 'forbidden' }, 403)
    return c.json({ items: await listDocuments(c.var.db, 100, (page - 1) * 100) })
  }
  return c.json({ items: await listImages(c.var.db, 100, (page - 1) * 100) })
})

/** Uploads that no page, post, menu, library entry or setting uses (the cleanup view). */
routes.get('/unused', requireCap('pages.manage', 'library.manage'), async (c) => c.json({ items: await unusedUploads(c.var.db) }))

/** A stored file by its address (the library keeps addresses, not ids). */
routes.get('/lookup', validate('query', mediaLookupQuery), async (c) => {
  const row = (await c.var.db.select({ id: media.id, path: media.path, mime: media.mime }).from(media).where(eq(media.path, mediaKey(c.req.valid('query').path))).limit(1))[0]
  return row ? c.json({ item: row }) : c.json({ error: 'not_found' }, 404)
})

/** Where a file is used. */
routes.get('/:id/usages', async (c) => {
  const row = await findMedia(c.var.db, c.req.param('id'))
  return row ? c.json({ usages: await usagesOf(c.var.db, row.path) }) : c.json({ error: 'not_found' }, 404)
})

routes.post('/', async (c) => {
  const user = userOf(c)
  const file = await readUpload(c)
  if (!file) return c.json({ error: 'upload_failed' }, 400)
  const result = await storeImage(c.var.db, file, user.id)
  if (!result.ok) return c.json({ error: result.error }, result.error === 'file_too_large' ? 413 : 422)
  await logAudit(c.var.db, { entityType: 'media', entityId: result.id, subject: result.url, action: 'media_uploaded', userId: user.id })
  return c.json({ url: result.url, id: result.id })
})

/**
 * Deletes a file: images need `pages.manage`, documents `library.manage` or `pages.manage`. A file still used
 * anywhere (also in the library list) is refused with 409 `in_use` and the list of places.
 */
routes.delete('/:id', async (c) => {
  const user = userOf(c)
  const row = await findMedia(c.var.db, c.req.param('id'))
  if (!row) return c.json({ error: 'not_found' }, 404)
  const allowed = row.mime.startsWith('image/') ? can(user, 'pages.manage') : can(user, 'library.manage') || can(user, 'pages.manage')
  if (!allowed) return c.json({ error: 'forbidden' }, 403)
  const usages = await usagesOf(c.var.db, row.path)
  if (usages.length) return c.json({ error: 'in_use', usages }, 409)
  const [gone] = await c.var.db.delete(media).where(eq(media.id, row.id)).returning({ path: media.path })
  if (!gone) return c.json({ error: 'not_found' }, 404)
  await revalidateSite(c.var.config, [TAG.all])
  await logAudit(c.var.db, { entityType: 'media', entityId: row.id, subject: gone.path, action: 'media_deleted', note: `${row.mime}, ${Math.round(row.size / 1024)} KB`, userId: user.id })
  return c.json({ ok: true })
})

async function findMedia(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined
  return (await db.select({ id: media.id, path: media.path, mime: media.mime, size: media.size }).from(media).where(eq(media.id, id)).limit(1))[0]
}

export default routes
