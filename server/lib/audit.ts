import { randomUUID } from 'node:crypto'
import type { AuditAction, AuditEntry } from '../../shared/pnw/types.ts'
import { insertAuditEntry, recentAuditEntries } from '../data/audit-repo.ts'

/** Ported from PNW_Audit::log(). */
export function logAudit(
  postId: string,
  action: AuditAction,
  fromStatus: string,
  toStatus: string,
  note?: string,
  userId: string | null = null,
): Promise<void> {
  const entry: AuditEntry = {
    id: randomUUID(),
    postId,
    userId,
    action,
    fromStatus,
    toStatus,
    note,
    createdAt: new Date().toISOString(),
  }
  return insertAuditEntry(entry)
}

/** Ported from PNW_Audit::recent() - newest first, optionally scoped to one post or without imported entries. */
export function recentAudit(limit: number, options: { postId?: string; excludeImported?: boolean } = {}): Promise<AuditEntry[]> {
  return recentAuditEntries(limit, options)
}
