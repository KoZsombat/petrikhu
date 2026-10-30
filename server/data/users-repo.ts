/**
 * Hírkezelő accounts, in PostgreSQL (see AGENT.md 6.15) - replaces the earlier
 * hardcoded seed-users.ts now that accounts are managed from inside the app
 * (Users.tsx) rather than by editing source and restarting the server.
 *
 * An account carries a plain list of capabilities and **no role** (AGENT.md
 * 6.16); the SQLite import script converts the old `role` column into one of these lists.
 */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import type { Capability } from '../../shared/pnw/types.ts'
import { isCapability } from '../../shared/pnw/permissions.ts'
import { row as one, rows as many, run } from './db.ts'
import { SEED_PASSWORD } from '../config.ts'

export type UserRecord = {
  id: string
  username: string
  displayName: string
  passwordHash: string
  permissions: Capability[]
}

type Row = {
  id: string
  username: string
  display_name: string
  password_hash: string
  permissions: string
}

function parsePermissions(raw: string): Capability[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCapability)
  } catch {
    return []
  }
}

function fromRow(row: Row): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    permissions: parsePermissions(row.permissions),
  }
}

function toRow(user: UserRecord): Row {
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    password_hash: user.passwordHash,
    permissions: JSON.stringify(user.permissions),
  }
}

const COLUMNS = 'id, username, display_name, password_hash, permissions'

export async function allUsers(): Promise<UserRecord[]> {
  return (await many<Row>(`SELECT ${COLUMNS} FROM users ORDER BY lower(display_name)`)).map(fromRow)
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id])
  return found ? fromRow(found) : undefined
}

export async function findUserByUsername(username: string): Promise<UserRecord | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM users WHERE lower(username) = lower($1)`, [username.trim()])
  return found ? fromRow(found) : undefined
}

export async function insertUser(user: UserRecord): Promise<void> {
  const r = toRow(user)
  await run('INSERT INTO users (id, username, display_name, password_hash, permissions) VALUES ($1, $2, $3, $4, $5)', [
    r.id, r.username, r.display_name, r.password_hash, r.permissions,
  ])
}

export async function updateUser(id: string, updater: (user: UserRecord) => UserRecord): Promise<UserRecord> {
  const existing = await findUserById(id)
  if (!existing) throw new Error(`no such user: ${id}`)
  const next = updater(existing)
  const r = toRow(next)
  await run('UPDATE users SET username = $2, display_name = $3, password_hash = $4, permissions = $5 WHERE id = $1', [
    r.id, r.username, r.display_name, r.password_hash, r.permissions,
  ])
  return next
}

export async function removeUser(id: string): Promise<void> {
  await run('DELETE FROM users WHERE id = $1', [id])
}

/**
 * The three original demo accounts (see 6.15), seeded once into an empty
 * table - so a fresh database still boots with working logins, but after
 * that these are ordinary rows, editable/removable from the Users.tsx
 * screen exactly like any account created there. Their permission sets are
 * what the deleted roles used to grant them (AGENT.md 6.16), plus the
 * Szerkesztő's right for the two leaders (6.19).
 */
export async function seedInitialUsers(): Promise<void> {
  const { n } = (await one<{ n: number }>('SELECT COUNT(*)::int AS n FROM users'))!
  if (n > 0) return

  const reviewerPermissions: Capability[] = [
    CAPABILITY.REVIEW_NEWS,
    CAPABILITY.MANAGE_PUBLISHED,
    CAPABILITY.VIEW_AUDIT_LOG,
    CAPABILITY.MANAGE_TERMS,
    CAPABILITY.MANAGE_USERS,
    // The Szerkesztő (AGENT.md 6.19); mk.vezeto deliberately has no such right.
    CAPABILITY.MANAGE_PAGES,
    CAPABILITY.MANAGE_LIBRARY,
  ]

  const seed: { username: string; displayName: string; password: string; permissions: Capability[] }[] = [
    {
      username: 'mk.vezeto',
      displayName: 'Kovács Anna',
      password: 'PetrikMK2026!',
      permissions: [CAPABILITY.SUBMIT_NEWS],
    },
    {
      username: 'helyettes',
      displayName: 'Nagy Péter',
      password: 'PetrikHelyettes2026!',
      permissions: reviewerPermissions,
    },
    {
      username: 'igazgato',
      displayName: 'Szabó Éva',
      password: 'PetrikIgazgato2026!',
      permissions: reviewerPermissions,
    },
  ]

  for (const user of seed) {
    await insertUser({
      id: randomUUID(),
      username: user.username,
      displayName: user.displayName,
      permissions: user.permissions,
      // A deployment sets PNW_SEED_PASSWORD, so the public demo passwords never exist there.
      passwordHash: bcrypt.hashSync(SEED_PASSWORD ?? user.password, 10),
    })
  }
}

/** A repóban nyilvános demó-jelszavak: élesben egyik fióknál sem maradhatnak érvényben. */
const DEMO_PASSWORDS: Record<string, string> = {
  'mk.vezeto': 'PetrikMK2026!',
  helyettes: 'PetrikHelyettes2026!',
  igazgato: 'PetrikIgazgato2026!',
}

/**
 * Élesben a nyilvánosan ismert demó-jelszavú fiókok jelszavát lecseréli a `PNW_SEED_PASSWORD`-re. Visszaadja, mely
 * fiókok jelszava volt még a demó (az üres lista a jó eset); ha nincs mire cserélni, a hívó dönt (leállás).
 */
export async function replaceDemoPasswords(replacement: string | undefined): Promise<string[]> {
  const affected: string[] = []
  for (const [username, demo] of Object.entries(DEMO_PASSWORDS)) {
    const user = await one<Row>(`SELECT ${COLUMNS} FROM users WHERE lower(username) = lower($1)`, [username])
    if (!user || !bcrypt.compareSync(demo, user.password_hash)) continue
    affected.push(username)
    if (replacement) await run('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(replacement, 12), user.id])
  }
  return affected
}
