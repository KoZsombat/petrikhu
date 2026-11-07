/** The media library: uploaded images (with WebP / AVIF variants), list and delete. */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import { media } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { listImages, storeImage } from '../lib/media.ts'

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

routes.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  return c.json({ items: await listImages(c.var.db, 100, (page - 1) * 100) })
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

/** Only editors and admins delete (a deleted image disappears from every page that uses it). */
routes.delete('/:id', requireCap('pages.manage'), async (c) => {
  const user = userOf(c)
  const id = c.req.param('id')
  if (!/^[0-9a-f-]{36}$/.test(id)) return c.json({ error: 'not_found' }, 404)
  const [row] = await c.var.db.delete(media).where(eq(media.id, id)).returning({ path: media.path })
  if (!row) return c.json({ error: 'not_found' }, 404)
  await logAudit(c.var.db, { entityType: 'media', entityId: id, subject: row.path, action: 'media_deleted', userId: user.id })
  return c.json({ ok: true })
})

export default routes
