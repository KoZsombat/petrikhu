/**
 * A statisztika (routes/statistics.ts) összesítő lekérdezései: egyik sem tölti be a hírek vagy a napló
 * sorait, mindent az adatbázis számol.
 */
import { STATUS } from '../../shared/pnw/types.ts'
import { row, rows } from './db.ts'

/** A "kint lévő vagy kint volt" hírek: ezekből készülnek a toplisták. */
const COUNTED = [STATUS.PUBLISH, STATUS.FUTURE, STATUS.ARCHIVED]
/** A megjelent (és azóta archivált) hírek: ezekből a havi számok. */
const APPEARED = [STATUS.PUBLISH, STATUS.ARCHIVED]

/** Hónaponként (YYYY-MM, UTC) a megjelent hírek száma, a `fromMonth`-tól kezdve. */
export async function appearedPerMonth(fromMonth: string): Promise<Map<string, number>> {
  const found = await rows<{ month: string; n: number }>(
    `SELECT left(date, 7) AS month, COUNT(*)::int AS n FROM posts
     WHERE status = ANY($1) AND left(date, 7) >= $2 GROUP BY 1`,
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

/** Egy hír minden kategóriájánál számít (a `category_ids` JSON-tömb). */
export async function topCategories(limit: number): Promise<Ranked[]> {
  return rows<Ranked>(
    `SELECT c.id AS key, COUNT(*)::int AS count
     FROM posts, json_array_elements_text(posts.category_ids::json) AS c(id)
     WHERE status = ANY($1) GROUP BY c.id ORDER BY count DESC, key LIMIT $2`,
    [COUNTED, limit],
  )
}

/**
 * Átlagos jóváhagyási idő másodpercben: hírenként az utolsó beküldéstől az utolsó döntésig (jóváhagyás vagy
 * időzítés); a döntés nélküli és a negatív (döntés a beküldés előtt) párok kimaradnak. 0, ha nincs adat.
 */
export async function averageApprovalSeconds(): Promise<number> {
  const result = await row<{ avg: number | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (decided::timestamptz - submitted::timestamptz)))::float8 AS avg
     FROM (
       SELECT MAX(created_at) FILTER (WHERE action = 'submitted') AS submitted,
              MAX(created_at) FILTER (WHERE action IN ('approved', 'scheduled')) AS decided
       FROM audit_log GROUP BY post_id
     ) per_post
     WHERE submitted IS NOT NULL AND decided IS NOT NULL AND decided::timestamptz >= submitted::timestamptz`,
  )
  return result?.avg ? Math.round(result.avg) : 0
}
