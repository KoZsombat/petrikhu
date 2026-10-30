/**
 * Verziózott séma-migrációk. Minden migráció egy `server/data/migrations/NNN_nev.ts` fájl, ami egy
 * `up(client)` függvényt exportál; a sorszám (NNN) a verzió. Induláskor (initDb) a még le nem futottak
 * sorban, egyenként egy-egy tranzakcióban futnak le, és a `schema_migrations` táblába kerülnek - így
 * minden migráció pontosan egyszer fut, akármennyiszer indul a szerver.
 *
 * Meglévő adatbázison (a migrációk előtti, `CREATE TABLE IF NOT EXISTS`-es korszakból) a 001 csak
 * rögzíti, hogy a séma megvan: az `IF NOT EXISTS` miatt semmit nem ír felül.
 *
 * Új migráció: új fájl a következő sorszámmal. Már lefutott migrációt soha ne módosíts - éles
 * adatbázisokon már nem futna le újra.
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

/** Két egyszerre induló folyamat (pl. szerver + import) ne futtassa ugyanazt kétszer. */
const LOCK_KEY = 7_303_011

/** A migrations mappa fájljai, verzió szerint; hibát dob, ha két fájlnak ugyanaz a sorszáma. */
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

/** Lefuttatja a hiányzó migrációkat; a lefutottak nevét adja vissza (üres lista: a séma naprakész). */
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
