import { and, eq, sql } from 'drizzle-orm'
import type { Role } from '@petrik/shared/roles'
import { can } from '@petrik/shared/roles'
import { passwordProblem } from '@petrik/shared/schemas'
import type { Account } from '@petrik/shared/schemas'
import type { Db } from '../db/client.ts'
import { accounts, sessions, users } from '../db/schema.ts'
import { hashPassword } from './auth.ts'

export type UserRow = typeof users.$inferSelect

export function toAccount(row: UserRow): Account {
  return { id: row.id, username: row.username ?? '', displayName: row.name, role: row.role as Role, mustChangePassword: row.mustChangePassword, createdAt: row.createdAt.toISOString() }
}

/** A placeholder e-mail: Better Auth needs one, logins are by username. */
export const placeholderEmail = (username: string) => `${username.toLowerCase()}@users.petrik.invalid`

export async function findUserByUsername(db: Db, username: string): Promise<UserRow | undefined> {
  return (await db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1))[0]
}

export class PasswordRuleError extends Error {
  constructor(public code: 'password_too_short' | 'password_too_long') {
    super(code)
  }
}

/** The shared password rule (passwordProblem) on every path that stores a new password; throws otherwise. */
export function assertPasswordRule(password: string): void {
  const problem = passwordProblem(password)
  if (problem) throw new PasswordRuleError(problem)
}

/**
 * Creates an account with a credential (password) login, the way Better Auth stores it. A plain `password` must
 * pass the password rule; `passwordHash` is only for accounts imported with their existing hash.
 */
export async function createUser(
  db: Db,
  input: { id?: string; username: string; displayName: string; role: Role; password?: string; passwordHash?: string; createdAt?: Date; mustChangePassword?: boolean },
): Promise<UserRow> {
  const id = input.id ?? crypto.randomUUID()
  const username = input.username.trim().toLowerCase()
  if (input.password !== undefined) assertPasswordRule(input.password)
  const hash = input.passwordHash ?? (await hashPassword(input.password ?? crypto.randomUUID()))
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({ id, name: input.displayName, email: placeholderEmail(username), username, displayUsername: input.username.trim(), role: input.role, mustChangePassword: input.mustChangePassword ?? false, ...(input.createdAt ? { createdAt: input.createdAt } : {}) })
      .returning()
    await tx.insert(accounts).values({ id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash })
    return row
  })
}

/**
 * Sets a new password (checked against the password rule, then hashed). `mustChange`: the account may do nothing
 * but change it at its next login (an admin set it, or it replaced a demo password); false clears the flag.
 */
export async function setPassword(db: Db, userId: string, password: string, options: { mustChange: boolean }): Promise<void> {
  assertPasswordRule(password)
  await storePasswordHash(db, userId, await hashPassword(password))
  await db.update(users).set({ mustChangePassword: options.mustChange, updatedAt: new Date() }).where(eq(users.id, userId))
}

/**
 * Replaces the stored hash of the SAME password (re-hashing an imported bcrypt hash at login). Never for a new
 * password: those go through setPassword.
 */
export async function storePasswordHash(db: Db, userId: string, hash: string): Promise<void> {
  await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
}

export async function passwordHashOf(db: Db, userId: string): Promise<string | null> {
  const row = (await db.select({ password: accounts.password }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))).limit(1))[0]
  return row?.password ?? null
}

/** Ends every session of a user, except `keepToken` (the one making the request, if any). */
export async function endSessions(db: Db, userId: string, keepSessionId?: string | null): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), keepSessionId ? sql`${sessions.id} <> ${keepSessionId}` : undefined))
}

/** Is anyone other than `exceptId` still able to manage accounts? */
export async function hasOtherAdmin(db: Db, exceptId: string): Promise<boolean> {
  const rows = await db.select({ id: users.id, role: users.role }).from(users)
  return rows.some((row) => row.id !== exceptId && can(row, 'users.manage'))
}
