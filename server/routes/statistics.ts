import { Router } from 'express'
import { CAPABILITY, STATUS } from '../../shared/pnw/types.ts'
import { countByStatus } from '../data/posts-repo.ts'
import { appearedPerMonth, averageApprovalSeconds, topAuthors, topCategories } from '../data/statistics-repo.ts'
import { requireCapability } from '../middleware/auth.ts'

const router = Router()

/** Ported from PNW_Statistics::render()'s data half - the markup is the frontend's job. Minden szám SQL-összesítés. */
router.get('/', requireCapability(CAPABILITY.VIEW_AUDIT_LOG), async (_req, res) => {
  const months = lastMonths(6)
  const [counts, perMonth, averageApproval, authors, categories] = await Promise.all([
    countByStatus(),
    appearedPerMonth(months[0]),
    averageApprovalSeconds(),
    topAuthors(8),
    topCategories(8),
  ])
  const live = counts[STATUS.PUBLISH] ?? 0
  const monthlyChart = months.map((key) => ({ key, count: perMonth.get(key) ?? 0 }))

  res.json({
    liveAll: live,
    liveManaged: live,
    scheduled: counts[STATUS.FUTURE] ?? 0,
    pending: counts[STATUS.PENDING] ?? 0,
    archived: counts[STATUS.ARCHIVED] ?? 0,
    monthPublished: monthlyChart[monthlyChart.length - 1].count,
    averageApprovalSeconds: averageApproval,
    monthlyChart,
    topAuthors: authors,
    topCategories: categories,
  })
})

/**
 * Az utolsó `count` hónap kulcsa (YYYY-MM), a legrégebbivel kezdve. A `date` mezők UTC ISO-szövegek
 * (toISOString()), ezért a kulcsok is Date.UTC-ből készülnek - a helyi getMonth() egy hónappal
 * visszacsúszna, ha a helyi zóna az UTC előtt jár (pl. Magyarország).
 */
function lastMonths(count: number): string[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export default router
