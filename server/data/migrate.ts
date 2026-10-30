/**
 * Versioned schema migrations. Every migration is a `server/data/migrations/NNN_name.ts` file exporting an
 * `up(client)` function; the number (NNN) is the version. On startup (initDb) the ones not yet run
 * run in order, each in its own transaction, and are recorded in the `schema_migrations` table - so
 * every migration runs exactly once, however often the server starts.
 *
 * On an existing database (from the pre-migration era, with `CREATE TABLE IF NOT EXISTS`) 001 only
 * records that the schema is there: thanks to `IF NOT EXISTS` it overwrites nothing.
 *
 * New migration: a new file with the next number. Never modify a migration that has already run - on production
 * databases it would not run again.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'

export type Migration = {
  version: number
  name: string
  up: (client: pg.PoolClient) => Promise<void>
}

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url)

/** Two processes starting at once (e.g. server + import) must not run the same thing twice. */
const LOCK_KEY = 7_303_011

/** The files of the migrations folder, by version; throws if two files share the same number. */
export async function loadMigrations(dir: URL = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = readdirSync(fileURLToPath(dir)).filter((file) => /^\d{3,}_[a-z0-9_-]+\.ts$/i.test(file)).sort()
  const migrations: Migration[] = []
  for (const file of files) {
    const version = Number(file.slice(0, file.indexOf('_')))
    if (migrations.some((m) => m.version === version)) throw new Error(`duplicate migration version ${version}: ${file}`)
    const module = (await import(new URL(file, dir).href)) as { up?: Migration['up'] }
    if (typeof module.up !== 'function') throw new Error(`migration ${file} has no up() export`)
    migrations.push({ version, name: file.replace(/\.ts$/, ''), up: module.up })
  }
  return migrations
}

/** Runs the missing migrations; returns the names of those that ran (empty list: the schema is up to date). */
export async function migrate(pool: pg.Pool, migrations?: Migration[]): Promise<string[]> {
  const list = migrations ?? (await loadMigrations())
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`)
    const done = new Set((await client.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version))
    for (const migration of list) {
      if (done.has(migration.version)) continue
      await client.query('BEGIN')
      try {
        await migration.up(client)
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw new Error(`migration ${migration.name} failed: ${(error as Error).message}`, { cause: error })
      }
      applied.push(migration.name)
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined)
    client.release()
  }
  return applied
}
