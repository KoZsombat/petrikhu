/** The 409 of a save that lost a race (optimistic concurrency): who saved in between, when, and the version now. */
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { users } from '../db/schema.ts'

export type ConflictBody = { error: 'conflict'; savedBy: string | null; savedAt: string | null; version: number }

export async function conflictBody(db: Db, current: { updatedById: string | null; updatedAt: Date | null; version: number }): Promise<ConflictBody> {
  const name = current.updatedById ? (await db.select({ name: users.name }).from(users).where(eq(users.id, current.updatedById)).limit(1))[0]?.name : undefined
  return { error: 'conflict', savedBy: name ?? null, savedAt: current.updatedAt?.toISOString() ?? null, version: current.version }
}
