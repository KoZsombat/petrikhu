import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import type { AuditEntityType } from '@petrik/shared/workflow'
import type { Db } from '../db/client.ts'
import { auditLog, users } from '../db/schema.ts'

export type AuditInput = {
  entityType: AuditEntityType
  entityId?: string | null
  subject?: string | null
  action: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  userId: string | null
}

/** Every admin action that changes content or rights writes one entry. */
export async function logAudit(db: Db, entry: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    subject: entry.subject ?? null,
    action: entry.action,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    note: entry.note ?? null,
    userId: entry.userId,
  })
}

export type AuditFilter = {
  entityType?: string
  entityId?: string
  userId?: string
  action?: string
  from?: Date
  to?: Date
  /** Leave out the hundreds of "imported" entries of the legacy migration. */
  excludeImported?: boolean
}

export async function listAudit(db: Db, filter: AuditFilter, limit: number, offset = 0) {
  const where = and(
    filter.entityType ? eq(auditLog.entityType, filter.entityType) : undefined,
    filter.entityId ? eq(auditLog.entityId, filter.entityId) : undefined,
    filter.userId ? eq(auditLog.userId, filter.userId) : undefined,
    filter.action ? eq(auditLog.action, filter.action) : undefined,
    filter.from ? gte(auditLog.createdAt, filter.from) : undefined,
    filter.to ? lt(auditLog.createdAt, filter.to) : undefined,
    filter.excludeImported ? sql`${auditLog.action} <> 'imported'` : undefined,
  )
  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      userId: auditLog.userId,
      userName: users.name,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      subject: auditLog.subject,
      action: auditLog.action,
      fromStatus: auditLog.fromStatus,
      toStatus: auditLog.toStatus,
      note: auditLog.note,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit)
    .offset(offset)
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(where)
  return { entries: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), total }
}
