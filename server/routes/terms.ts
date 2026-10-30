/**
 * Categories and tags (AGENT.md 6.16). Listing is genuinely public - a
 * published post shows its category names on the open site, so the static
 * pages (src/lib/terms.ts) need this without a session, exactly like
 * /api/public/posts. Creating needs `pnw_manage_terms`; *using* an existing
 * term needs no permission at all.
 */
import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import type { TermKind } from '../../shared/pnw/types.ts'
import { allTerms, createTerm, findTermByName } from '../data/terms-repo.ts'
import { requireCapability } from '../middleware/auth.ts'

const router = Router()

const MAX_NAME_LENGTH = 60

function isTermKind(value: unknown): value is TermKind {
  return value === 'category' || value === 'tag'
}

router.get('/', async (_req, res) => {
  res.json({ terms: await allTerms() })
})

router.post('/', requireCapability(CAPABILITY.MANAGE_TERMS), async (req, res) => {
  const kind = req.body?.kind
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

  if (!isTermKind(kind)) {
    res.status(422).json({ error: 'invalid_term_kind' })
    return
  }
  if (!name || name.length > MAX_NAME_LENGTH) {
    res.status(422).json({ error: 'invalid_term_name' })
    return
  }
  if (await findTermByName(kind, name)) {
    res.status(409).json({ error: 'term_exists' })
    return
  }

  res.json({ term: await createTerm(kind, name, req.pnwUser!.id) })
})

export default router
