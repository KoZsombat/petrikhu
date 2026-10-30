import { randomUUID } from 'node:crypto'
import type { AuditAction, AuditEntry } from '../../shared/pnw/types.ts'
import { allAuditEntries, insertAuditEntry, recentAuditEntries } from '../data/audit-repo.ts'

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

/** Ported from PNW_Audit::recent() - newest first, optionally scoped to one post. */
export function recentAudit(limit: number, postId?: string): Promise<AuditEntry[]> {
  return recentAuditEntries(limit, postId)
}

export function allAudit(): Promise<AuditEntry[]> {
  return allAuditEntries()
}
