/**
 * Egyszeri import: a régi SQLite adatbázis (server/data/db/hirkezelo.db) minden táblája a PostgreSQL-be.
 *
 *   DATABASE_URL=postgres://... npm run db:import [-- /út/a/hirkezelo.db]
 *
 * Idempotens (`ON CONFLICT DO NOTHING`): többször is lefuttatható, a már meglévő sorokat nem írja felül.
 * A `better-sqlite3` csak fejlesztői függőség, a futó szerver nem használja. A munkamenetek nem kerülnek át
 * (mindenkinek újra be kell lépnie).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { LEGACY_SQLITE_FILE } from '../config.ts'
import { closeDb, initDb, pool } from '../data/db.ts'

const file = process.argv[2] ? resolve(process.argv[2]) : LEGACY_SQLITE_FILE
if (!existsSync(file)) {
  console.error(`Nincs ilyen SQLite fájl: ${file}`)
  process.exit(1)
}

const sqlite = new Database(file, { readonly: true, fileMustExist: true })
await initDb()

const TABLES = ['users', 'terms', 'creator_pages', 'posts', 'audit_log', 'site_menu', 'site_library', 'media_files'] as const

/** A régi, szerepkör-alapú fiókok jogai (a db.ts régi migrációja ugyanezt csinálta). */
const LEGACY_ROLES: Record<string, string[]> = {
  petrik_mk_leader: [CAPABILITY.SUBMIT_NEWS],
  petrik_deputy_director: [CAPABILITY.REVIEW_NEWS, CAPABILITY.MANAGE_PUBLISHED, CAPABILITY.VIEW_AUDIT_LOG, CAPABILITY.MANAGE_TERMS, CAPABILITY.MANAGE_USERS],
  petrik_director: [CAPABILITY.REVIEW_NEWS, CAPABILITY.MANAGE_PUBLISHED, CAPABILITY.VIEW_AUDIT_LOG, CAPABILITY.MANAGE_TERMS, CAPABILITY.MANAGE_USERS],
}

function hasTable(name: string): boolean {
  return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined
}

async function pgColumns(table: string): Promise<string[]> {
  const result = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [table])
  return result.rows.map((r) => r.column_name as string)
}

for (const table of TABLES) {
  if (!hasTable(table)) {
    console.log(`${table}: nincs a forrásban, kihagyom`)
    continue
  }
  const source = new Set((sqlite.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name))
  const columns = (await pgColumns(table)).filter((c) => source.has(c))
  const legacyRoles = table === 'users' && source.has('role') && !source.has('permissions')
  const insertColumns = legacyRoles ? [...columns, 'permissions'] : columns
  const sql = `INSERT INTO ${table} (${insertColumns.join(', ')}) VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`

  let total = 0
  let added = 0
  for (const record of sqlite.prepare(`SELECT * FROM ${table}`).iterate() as Iterable<Record<string, unknown>>) {
    const values = columns.map((c) => record[c])
    if (legacyRoles) values.push(JSON.stringify(LEGACY_ROLES[String(record.role)] ?? []))
    added += (await pool.query(sql, values)).rowCount ?? 0
    total += 1
    if (total % 500 === 0) console.log(`${table}: ${total}...`)
  }
  console.log(`${table}: ${total} sor a forrásban, ${added} új került be`)
}

sqlite.close()
await closeDb()
console.log('Kész.')
