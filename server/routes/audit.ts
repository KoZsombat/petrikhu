import { Router } from 'express'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { requireCapability } from '../middleware/auth.ts'
import { recentAudit } from '../lib/audit.ts'

const router = Router()

/** Mirrors render_audit() - the full event log, newest first. */
router.get('/', requireCapability(CAPABILITY.VIEW_AUDIT_LOG), async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 100)
  // A régi oldalról importált hírek bejegyzései (több száz, egy időpontból) elnyomnák a valódi eseményeket: alapból kimaradnak.
  const withImported = req.query.imported === '1'
  const entries = withImported ? await recentAudit(limit) : (await recentAudit(5000)).filter((entry) => entry.action !== 'imported').slice(0, limit)
  res.json({ entries })
})

export default router
