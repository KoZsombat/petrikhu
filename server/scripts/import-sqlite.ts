/**
 * One-off import: every table of the old SQLite database (server/data/db/hirkezelo.db) into PostgreSQL.
 *
 *   DATABASE_URL=postgres://... npm run db:import [-- /út/a/hirkezelo.db]
 *
 * Idempotent (`ON CONFLICT DO NOTHING`): it can be run several times, and existing rows are not overwritten.
 * `better-sqlite3` is only a dev dependency, the running server does not use it. Sessions are not copied
 * (everyone has to log in again).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { CAPABILITY } from '../../shared/pnw/types.ts'
import { LEGACY_SQLITE_FILE } from '../config.ts'
import { closeDb, initDb, pool } from '../data/db.ts'
import { fillMissingSearchText } from '../data/posts-repo.ts'

const file = process.argv[2] ? resolve(process.argv[2]) : LEGACY_SQLITE_FILE
if (!existsSync(file)) {
  console.error(`No such SQLite file: ${file}`)
  process.exit(1)
}

const sqlite = new Database(file, { readonly: true, fileMustExist: true })
// Old dates without a time zone count as UTC (as in migration 004).
pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'").catch(() => undefined)
})
await initDb()

// Because of the foreign keys, the referenced table comes first (accounts → categories → pages → posts → log).
const TABLES = ['users', 'terms', 'creator_pages', 'posts', 'audit_log', 'site_menu', 'site_library', 'media_files'] as const

/** Referencing columns (migration 004): a value pointing to a non-existent account / post is inserted as NULL. */
const REFERENCES: Partial<Record<(typeof TABLES)[number], Record<string, 'users' | 'posts'>>> = {
  terms: { created_by_id: 'users' },
  creator_pages: { author_id: 'users', modified_by_id: 'users' },
  posts: { author_id: 'users', last_reviewer_id: 'users', scheduled_by_id: 'users', archived_by_id: 'users' },
  audit_log: { user_id: 'users', post_id: 'posts' },
}

async function idsOf(table: 'users' | 'posts'): Promise<Set<string>> {
  return new Set((await pool.query<{ id: string }>(`SELECT id FROM ${table}`)).rows.map((r) => r.id))
}

/** The rights of the old, role-based accounts (the old db.ts migration did the same). */
const LEGACY_ROLES: Record<string, string[]> = {
  petrik_mk_leader: [CAPABILITY.SUBMIT_NEWS],
  petrik_deputy_director: [CAPABILITY.REVIEW_NEWS, CAPABILITY.MANAGE_PUBLISHED, CAPABILITY.VIEW_AUDIT_LOG, CAPABILITY.MANAGE_TERMS, CAPABILITY.MANAGE_USERS],
  petrik_director: [CAPABILITY.REVIEW_NEWS, CAPABILITY.MANAGE_PUBLISHED, CAPABILITY.VIEW_AUDIT_LOG, CAPABILITY.MANAGE_TERMS, CAPABILITY.MANAGE_USERS],
}

function hasTable(name: string): boolean {
  return sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined
}

async function pgColumns(table: string): Promise<string[]> {
  const result = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table])
  return result.rows.map((r) => r.column_name as string)
}

for (const table of TABLES) {
  if (!hasTable(table)) {
    console.log(`${table}: not in the source, skipping`)
    continue
  }
  const source = new Set((sqlite.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name))
  const columns = (await pgColumns(table)).filter((c) => source.has(c))
  const legacyRoles = table === 'users' && source.has('role') && !source.has('permissions')
  const insertColumns = legacyRoles ? [...columns, 'permissions'] : columns
  const sql = `INSERT INTO ${table} (${insertColumns.join(', ')}) VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`

  const references = REFERENCES[table] ?? {}
  const known = { users: await idsOf('users'), posts: await idsOf('posts') }
  let total = 0
  let added = 0
  let orphans = 0
  for (const record of sqlite.prepare(`SELECT * FROM ${table}`).iterate() as Iterable<Record<string, unknown>>) {
    const values = columns.map((c) => {
      const target = references[c]
      if (!target || record[c] === null || record[c] === undefined || known[target].has(String(record[c]))) return record[c]
      orphans += 1
      return null
    })
    if (legacyRoles) values.push(JSON.stringify(LEGACY_ROLES[String(record.role)] ?? []))
    added += (await pool.query(sql, values)).rowCount ?? 0
    total += 1
    if (total % 500 === 0) console.log(`${table}: ${total}...`)
  }
  console.log(`${table}: ${total} rows in the source, ${added} new inserted${orphans ? `, ${orphans} orphaned references set to NULL` : ''}`)
}

sqlite.close()
// The old database has no search text (migration 003): the imported posts' search text is computed here.
console.log(`posts: ${await fillMissingSearchText()} search texts filled in`)
await closeDb()
console.log('Done.')
