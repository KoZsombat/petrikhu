/** The audit log (filterable) and the news statistics; both need `audit.view`. */
import { Hono } from 'hono'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { AppEnv } from '../context.ts'
import { requireCap } from '../context.ts'
import { auditLog, documents, documentTerms, terms, users } from '../db/schema.ts'
import { listAudit } from '../lib/audit.ts'
import { countSql } from '../lib/documents.ts'

export const audit = new Hono<AppEnv>()
audit.use(requireCap('audit.view'))

const date = (value: string | undefined) => {
  const parsed = value ? new Date(value) : undefined
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined
}

audit.get('/', async (c) => {
  const q = c.req.query()
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
  const page = Math.max(1, Number(q.page) || 1)
  const result = await listAudit(
    c.var.db,
    {
      entityType: q.entityType || undefined,
      entityId: q.entityId || undefined,
      userId: q.userId || undefined,
      action: q.action || undefined,
      from: date(q.from),
      to: date(q.to),
      excludeImported: q.imported !== '1',
    },
    limit,
    (page - 1) * limit,
  )
  return c.json({ ...result, page, totalPages: Math.max(1, Math.ceil(result.total / limit)) })
})

export const statistics = new Hono<AppEnv>()
statistics.use(requireCap('audit.view'))

/** The last `count` months as YYYY-MM keys (UTC), oldest first. */
function lastMonths(count: number): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

statistics.get('/', async (c) => {
  const db = c.var.db
  const isPost = eq(documents.type, 'post')
  const months = lastMonths(6)
  const counted = ['published', 'scheduled', 'archived']
  const [byStatus, perMonth, approval, authors, categories] = await Promise.all([
    db.select({ status: documents.status, n: countSql }).from(documents).where(isPost).groupBy(documents.status),
    db
      .select({ month: sql<string>`to_char(${documents.publishedAt} AT TIME ZONE 'UTC', 'YYYY-MM')`, n: countSql })
      .from(documents)
      .where(and(isPost, inArray(documents.status, ['published', 'archived']), sql`${documents.publishedAt} >= ${`${months[0]}-01T00:00:00Z`}::timestamptz`))
      .groupBy(sql`1`),
    db.execute<{ avg: number | null }>(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (decided - submitted)))::float8 AS avg FROM (
        SELECT MAX(created_at) FILTER (WHERE action = 'submitted') AS submitted,
               MAX(created_at) FILTER (WHERE action IN ('approved', 'scheduled')) AS decided
        FROM ${auditLog} WHERE entity_type = 'post' GROUP BY entity_id
      ) per_post WHERE submitted IS NOT NULL AND decided IS NOT NULL AND decided >= submitted`),
    db
      .select({ id: documents.authorId, name: users.name, count: countSql })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.authorId))
      .where(and(isPost, inArray(documents.status, counted)))
      .groupBy(documents.authorId, users.name)
      .orderBy(sql`3 DESC`, sql`2`)
      .limit(8),
    db
      .select({ id: terms.id, name: terms.name, count: countSql })
      .from(documentTerms)
      .innerJoin(terms, and(eq(terms.id, documentTerms.termId), eq(terms.kind, 'category')))
      .innerJoin(documents, eq(documents.id, documentTerms.documentId))
      .where(inArray(documents.status, counted))
      .groupBy(terms.id, terms.name)
      .orderBy(sql`3 DESC`, sql`2`)
      .limit(8),
  ])
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>
  const monthMap = new Map(perMonth.map((r) => [r.month, r.n]))
  const monthlyChart = months.map((key) => ({ key, count: monthMap.get(key) ?? 0 }))
  return c.json({
    published: counts.published ?? 0,
    scheduled: counts.scheduled ?? 0,
    inReview: counts.in_review ?? 0,
    archived: counts.archived ?? 0,
    monthPublished: monthlyChart[monthlyChart.length - 1].count,
    averageApprovalSeconds: Math.round(approval[0]?.avg ?? 0),
    monthlyChart,
    topAuthors: authors.map((a) => ({ name: a.name ?? '—', count: a.count })),
    topCategories: categories.map((t) => ({ name: t.name, count: t.count })),
  })
})
