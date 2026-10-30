/**
 * The Dokumentumtár's API (AGENT.md 6.24), mounted at /api/pages/library. Kept
 * out of routes/pages.ts, which gates everything on MANAGE_PAGES: the library
 * has a permission of its own.
 */
import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { requireCapability } from '../middleware/auth.ts'
import { clearLibrary, getLibrary, putLibrary } from '../data/library-repo.ts'
import { sanitizeLibrary } from '../lib/validation.ts'
import { storeDocument, uploadDocument } from '../lib/uploads.ts'

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
  res.json({ library })
})

/** "Visszaállítás az eredetire" - the site falls back to src/data/docs.ts. */
router.delete('/', async (_req, res) => {
  await clearLibrary()
  res.json({ ok: true })
})

router.post(
  '/file',
  (req, res, next) => {
    uploadDocument.single('file')(req, res, (error) => {
      if (error) {
        res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'upload_failed' })
        return
      }
      next()
    })
  },
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
