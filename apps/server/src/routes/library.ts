/** The document library (Dokumentumtár): its categories and documents, and document uploads. */
import { Hono } from 'hono'
import { z } from 'zod'
import { librarySchema } from '@petrik/shared/schemas'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import { logAudit } from '../lib/audit.ts'
import { storeDocument } from '../lib/media.ts'
import { defaultLibrary, getSetting, putSetting } from '../lib/seed.ts'
import { validate } from '../lib/validate.ts'
import { readUpload } from './media.ts'

const library = new Hono<AppEnv>()
library.use(requireCap('library.manage'))

library.get('/', async (c) => c.json({ library: (await getSetting(c.var.db, 'library')) ?? (await defaultLibrary()) }))

library.put('/', validate('json', z.object({ library: librarySchema })), async (c) => {
  const user = userOf(c)
  const { library: value } = c.req.valid('json')
  await putSetting(c.var.db, 'library', value, user.id)
  const count = value.categories.reduce((n, category) => n + category.docs.length, 0)
  await logAudit(c.var.db, { entityType: 'library', subject: 'Dokumentumtár', action: 'library_updated', note: `${value.categories.length} kategória, ${count} dokumentum`, userId: user.id })
  return c.json({ library: value })
})

library.delete('/', async (c) => {
  const user = userOf(c)
  const value = await defaultLibrary()
  await putSetting(c.var.db, 'library', value, user.id)
  await logAudit(c.var.db, { entityType: 'library', subject: 'Dokumentumtár', action: 'library_reset', userId: user.id })
  return c.json({ library: value })
})

library.post('/file', async (c) => {
  const user = userOf(c)
  const file = await readUpload(c)
  if (!file) return c.json({ error: 'upload_failed' }, 400)
  const result = await storeDocument(c.var.db, file, user.id)
  if (!result.ok) return c.json({ error: result.error }, result.error === 'file_too_large' ? 413 : 422)
  await logAudit(c.var.db, { entityType: 'media', entityId: result.id, subject: result.url, action: 'media_uploaded', userId: user.id })
  return c.json({ url: result.url })
})

export default library
