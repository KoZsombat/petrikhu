import type { AuditEntityType, AuditEntry } from '../../shared/pnw/types.ts'
import { rows, run } from './db.ts'

type Row = {
  id: string
  entity_type: string
  entity_id: string | null
  subject: string | null
  post_id: string | null
  user_id: string | null
  action: string
  from_status: string
  to_status: string
  note: string | null
  created_at: string
}

function fromRow(row: Row): AuditEntry {
  return {
    id: row.id,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id ?? '',
    subject: row.subject ?? undefined,
    // The entry of a permanently deleted post is kept (ON DELETE SET NULL), with an empty post id.
    postId: row.post_id ?? '',
    userId: row.user_id,
    action: row.action as AuditEntry['action'],
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  }
}

export async function insertAuditEntry(entry: AuditEntry): Promise<void> {
  await run(
    `INSERT INTO audit_log (id, entity_type, entity_id, subject, post_id, user_id, action, from_status, to_status, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      entry.id, entry.entityType, entry.entityId || null, entry.subject ?? null, entry.postId || null, entry.userId,
      entry.action, entry.fromStatus, entry.toStatus, entry.note ?? null, entry.createdAt,
    ],
  )
}

/** The latest entries; narrowed to one post with `postId`, without the imported ones with `excludeImported` - all in SQL. */
export async function recentAuditEntries(limit: number, options: { postId?: string; excludeImported?: boolean } = {}): Promise<AuditEntry[]> {
  const where: string[] = []
  const params: unknown[] = []
  if (options.postId) {
    params.push(options.postId)
    where.push(`post_id = $${params.length}`)
  }
  if (options.excludeImported) where.push("action <> 'imported'")
  params.push(limit)
  const sql = `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id LIMIT $${params.length}`
  return (await rows<Row>(sql, params)).map(fromRow)
}
