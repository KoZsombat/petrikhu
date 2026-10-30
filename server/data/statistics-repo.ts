/**
 * The statistics (routes/statistics.ts) aggregate queries: none of them loads the posts or the log
 * rows, the database computes everything.
 */
import { STATUS } from '../../shared/pnw/types.ts'
import { row, rows } from './db.ts'

/** The posts that are or were published ("kint"): the top lists are built from these. */
const COUNTED = [STATUS.PUBLISH, STATUS.FUTURE, STATUS.ARCHIVED]
/** The published (and since archived) posts: the monthly figures come from these. */
const APPEARED = [STATUS.PUBLISH, STATUS.ARCHIVED]

/** Per month (YYYY-MM, UTC) the number of published posts, starting from `fromMonth`. */
export async function appearedPerMonth(fromMonth: string): Promise<Map<string, number>> {
  const found = await rows<{ month: string; n: number }>(
    `SELECT to_char(date AT TIME ZONE 'UTC', 'YYYY-MM') AS month, COUNT(*)::int AS n FROM posts
     WHERE status = ANY($1) AND date >= ($2 || '-01T00:00:00Z')::timestamptz GROUP BY 1`,
    [APPEARED, fromMonth],
  )
  return new Map(found.map((r) => [r.month, r.n]))
}

export type Ranked = { key: string; count: number }

export async function topAuthors(limit: number): Promise<Ranked[]> {
  return rows<Ranked>(
    `SELECT author_id AS key, COUNT(*)::int AS count FROM posts WHERE status = ANY($1)
     GROUP BY author_id ORDER BY count DESC, key LIMIT $2`,
    [COUNTED, limit],
  )
}

/** Counts for each category of a post (the `category_ids` JSON array). */
export async function topCategories(limit: number): Promise<Ranked[]> {
  return rows<Ranked>(
    `SELECT c.id AS key, COUNT(*)::int AS count
     FROM posts, jsonb_array_elements_text(posts.category_ids) AS c(id)
     WHERE status = ANY($1) GROUP BY c.id ORDER BY count DESC, key LIMIT $2`,
    [COUNTED, limit],
  )
}

/**
 * Average approval time in seconds: per post, from the last submission to the last decision (approval or
 * scheduling); pairs without a decision and negative ones (decision before submission) are left out. 0 if there is no data.
 */
export async function averageApprovalSeconds(): Promise<number> {
  const result = await row<{ avg: number | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (decided - submitted)))::float8 AS avg
     FROM (
       SELECT MAX(created_at) FILTER (WHERE action = 'submitted') AS submitted,
              MAX(created_at) FILTER (WHERE action IN ('approved', 'scheduled')) AS decided
       FROM audit_log GROUP BY post_id
     ) per_post
     WHERE submitted IS NOT NULL AND decided IS NOT NULL AND decided >= submitted`,
  )
  return result?.avg ? Math.round(result.avg) : 0
}
