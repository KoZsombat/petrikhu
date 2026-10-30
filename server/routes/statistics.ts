import { Router } from 'express'
import { CAPABILITY, STATUS } from '../../shared/pnw/types.ts'
import type { PostStatus } from '../../shared/pnw/types.ts'
import { allPosts } from '../data/posts-repo.ts'
import { allAudit } from '../lib/audit.ts'
import { requireCapability } from '../middleware/auth.ts'

const router = Router()

/** Ported from PNW_Statistics::render()'s data half - the markup is the frontend's job. */
router.get('/', requireCapability(CAPABILITY.VIEW_AUDIT_LOG), async (_req, res) => {
  const all = await allPosts()
  const live = all.filter((p) => p.status === STATUS.PUBLISH)
  const scheduled = all.filter((p) => p.status === STATUS.FUTURE)
  const pending = all.filter((p) => p.status === STATUS.PENDING)
  const archived = all.filter((p) => p.status === STATUS.ARCHIVED)

  const now = new Date()
  const monthKey = now.toISOString().slice(0, 7)
  const monthPublished = all.filter(
    (p) =>
      (p.status === STATUS.PUBLISH || p.status === STATUS.ARCHIVED) && (p.date ?? '').slice(0, 7) === monthKey,
  ).length

  const averageApprovalSeconds = await computeAverageApprovalSeconds()

  const liveOrArchivedOrFuture = all.filter((p) =>
    ([STATUS.PUBLISH, STATUS.FUTURE, STATUS.ARCHIVED] as PostStatus[]).includes(p.status),
  )

  res.json({
    liveAll: live.length,
    liveManaged: live.length,
    scheduled: scheduled.length,
    pending: pending.length,
    archived: archived.length,
    monthPublished,
    averageApprovalSeconds,
    monthlyChart: monthlyChart(all),
    topAuthors: topBy(liveOrArchivedOrFuture, (p) => p.authorId).slice(0, 8),
    topCategories: topBy(
      liveOrArchivedOrFuture.flatMap((p) => p.categoryIds.map((id) => ({ ...p, categoryId: id }))),
      (p) => p.categoryId,
    ).slice(0, 8),
  })
})

async function computeAverageApprovalSeconds(): Promise<number> {
  const entries = await allAudit()
  const byPost = new Map<string, { submittedAt?: string; decidedAt?: string }>()

  for (const entry of entries) {
    const bucket = byPost.get(entry.postId) ?? {}
    if (entry.action === 'submitted') bucket.submittedAt = entry.createdAt
    if (entry.action === 'approved' || entry.action === 'scheduled') bucket.decidedAt = entry.createdAt
    byPost.set(entry.postId, bucket)
  }

  const durations: number[] = []
  for (const { submittedAt, decidedAt } of byPost.values()) {
    if (!submittedAt || !decidedAt) continue
    const seconds = (new Date(decidedAt).getTime() - new Date(submittedAt).getTime()) / 1000
    if (seconds >= 0) durations.push(seconds)
  }

  if (durations.length === 0) return 0
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
}

function monthlyChart(all: { status: string; date: string }[]): { key: string; count: number }[] {
  const months: { key: string; count: number }[] = []
  const now = new Date()
  const baseYear = now.getUTCFullYear()
  const baseMonth = now.getUTCMonth()

  // `date` fields are stored as UTC ISO strings (toISOString()), so the chart's
  // own month keys are built from Date.UTC too - building them from local
  // getFullYear()/getMonth() and reading back with toISOString() rolls the
  // month back by one whenever the local zone is ahead of UTC (e.g. Hungary).
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(baseYear, baseMonth - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    months.push({ key, count: 0 })
  }

  const byKey = new Map(months.map((m) => [m.key, m]))
  for (const post of all) {
    if (post.status !== STATUS.PUBLISH && post.status !== STATUS.ARCHIVED) continue
    const key = (post.date ?? '').slice(0, 7)
    const bucket = byKey.get(key)
    if (bucket) bucket.count += 1
  }

  return months
}

function topBy<T>(list: T[], keyOf: (item: T) => string): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of list) {
    const key = keyOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

export default router
