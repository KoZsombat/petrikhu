import { randomUUID } from 'node:crypto'
import type { AuditAction, AuditEntityType, AuditEntry } from '../../shared/pnw/types.ts'
import { insertAuditEntry, recentAuditEntries } from '../data/audit-repo.ts'

/** Ported from PNW_Audit::log() - a post status change. */
export function logAudit(
  postId: string,
  action: AuditAction,
  fromStatus: string,
  toStatus: string,
  note?: string,
  userId: string | null = null,
  subject?: string,
): Promise<void> {
  return insertAuditEntry({
    id: randomUUID(),
    entityType: 'post',
    entityId: postId,
    subject,
    postId,
    userId,
    action,
    fromStatus,
    toStatus,
    note,
    createdAt: new Date().toISOString(),
  })
}

/** A non-post event (page, menu, library, account) into the shared log. */
export function logEvent(
  entityType: Exclude<AuditEntityType, 'post'>,
  action: AuditAction,
  userId: string | null,
  details: { entityId?: string; subject?: string; note?: string } = {},
): Promise<void> {
  const entry: AuditEntry = {
    id: randomUUID(),
    entityType,
    entityId: details.entityId ?? '',
    subject: details.subject,
    postId: '',
    userId,
    action,
    fromStatus: '',
    toStatus: '',
    note: details.note,
    createdAt: new Date().toISOString(),
  }
  return insertAuditEntry(entry)
}

/** Ported from PNW_Audit::recent() - newest first, optionally scoped to one post or without imported entries. */
export function recentAudit(limit: number, options: { postId?: string; excludeImported?: boolean } = {}): Promise<AuditEntry[]> {
  return recentAuditEntries(limit, options)
}
