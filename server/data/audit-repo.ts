import type { AuditEntry } from '../../shared/pnw/types.ts'
import { rows, run } from './db.ts'

type Row = {
  id: string
  post_id: string
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
    postId: row.post_id,
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
    `INSERT INTO audit_log (id, post_id, user_id, action, from_status, to_status, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [entry.id, entry.postId, entry.userId, entry.action, entry.fromStatus, entry.toStatus, entry.note ?? null, entry.createdAt],
  )
}

export async function recentAuditEntries(limit: number, postId?: string): Promise<AuditEntry[]> {
  const result = postId
    ? await rows<Row>('SELECT * FROM audit_log WHERE post_id = $1 ORDER BY created_at DESC LIMIT $2', [postId, limit])
    : await rows<Row>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1', [limit])
  return result.map(fromRow)
}

/** Every entry, unfiltered - only the statistics module's average-approval-time calc needs this. */
export async function allAuditEntries(): Promise<AuditEntry[]> {
  return (await rows<Row>('SELECT * FROM audit_log')).map(fromRow)
}
