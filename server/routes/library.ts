/**
 * The Dokumentumtár's API (AGENTS.md "Server" (document library)), mounted at /api/pages/library. Kept
 * out of routes/pages.ts, which gates everything on MANAGE_PAGES: the library
 * has a permission of its own.
 */
import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { requireCapability } from '../middleware/auth.ts'
import { clearLibrary, getLibrary, putLibrary } from '../data/library-repo.ts'
import { sanitizeLibrary } from '../lib/validation.ts'
import { acceptUpload, storeDocument, uploadDocument } from '../lib/uploads.ts'
import { logEvent } from '../lib/audit.ts'

const router = Router()

router.use(requireCapability(CAPABILITY.MANAGE_LIBRARY))

router.get('/', async (_req, res) => {
  const stored = await getLibrary()
  res.json({ library: stored?.library ?? null, modifiedAt: stored?.modifiedAt ?? null })
})

router.put('/', async (req, res) => {
  const library = sanitizeLibrary(req.body?.library)
  if (!library) {
    res.status(422).json({ error: 'invalid_library' })
    return
  }
  await putLibrary(library)
  const documents = library.categories.reduce((n, category) => n + category.docs.length, 0)
  await logEvent('library', 'library_updated', req.pnwUser!.id, { note: `${library.categories.length} kategória, ${documents} dokumentum` })
  res.json({ library })
})

/** "Visszaállítás az eredetire" - the site falls back to src/data/docs.ts. */
router.delete('/', async (req, res) => {
  await clearLibrary()
  await logEvent('library', 'library_reset', req.pnwUser!.id)
  res.json({ ok: true })
})

router.post(
  '/file',
  acceptUpload(uploadDocument, 'file'),
  async (req, res) => {
    const url = await storeDocument(req.file)
    if (!url) {
      res.status(422).json({ error: 'unsupported_file' })
      return
    }
    res.json({ url })
  },
)

export default router
