// Verziózott migrációk (server/data/migrate.ts): üres és régi (migrációk előtti) adatbázison is.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { TEST_DATABASE_URL } from './helpers/server.ts'
import { loadMigrations, migrate } from '../server/data/migrate.ts'
import type { Migration } from '../server/data/migrate.ts'

const admin = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
const schemas: string[] = []
const pools: pg.Pool[] = []

/** Egy friss, üres séma és egy rá mutató kapcsolat. */
async function freshSchema(): Promise<pg.Pool> {
  const schema = `m_${randomBytes(6).toString('hex')}`
  await admin.query(`CREATE SCHEMA ${schema}`)
  schemas.push(schema)
  const url = new URL(TEST_DATABASE_URL)
  url.searchParams.set('options', `-c search_path=${schema}`)
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 })
  pools.push(pool)
  return pool
}

let all: Migration[]
before(async () => {
  all = await loadMigrations()
})
after(async () => {
  for (const pool of pools) await pool.end()
  for (const schema of schemas) await admin.query(`DROP SCHEMA ${schema} CASCADE`)
  await admin.end()
})

const versions = async (pool: pg.Pool) => (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version)

test('a migrációs fájlok sorszáma egyedi és növekvő', () => {
  assert.ok(all.length >= 1)
  assert.equal(all[0].version, 1)
  for (let i = 1; i < all.length; i += 1) assert.ok(all[i].version > all[i - 1].version)
})

test('üres adatbázison mindet lefuttatja, másodszorra semmit', async () => {
  const pool = await freshSchema()
  assert.equal((await migrate(pool)).length, all.length)
  assert.deepEqual(await versions(pool), all.map((m) => m.version))
  assert.deepEqual(await migrate(pool), [])
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()")).rows.map((r) => r.table_name)
  for (const table of ['posts', 'users', 'creator_pages', 'audit_log', 'media_files', 'sessions']) assert.ok(tables.includes(table), table)
})

test('migrációk előtti adatbázison elindul, és az adatot megtartja', async () => {
  const pool = await freshSchema()
  // A régi db.ts sémája: a 001 pontosan ezt futtatta minden induláskor, schema_migrations nélkül.
  const client = await pool.connect()
  await all[0].up(client)
  client.release()
  await pool.query("INSERT INTO users (id, username, display_name, password_hash) VALUES ('u1', 'regi', 'Régi Fiók', 'x')")
  await migrate(pool)
  assert.deepEqual(await versions(pool), all.map((m) => m.version))
  assert.equal((await pool.query("SELECT display_name FROM users WHERE id = 'u1'")).rows[0].display_name, 'Régi Fiók')
})

test('hibás migráció visszagörgetődik, és nem rögzül', async () => {
  const pool = await freshSchema()
  await migrate(pool)
  const broken: Migration = {
    version: 9999,
    name: '9999_broken',
    up: async (c) => {
      await c.query('CREATE TABLE half_done (id INT)')
      await c.query('SELECT * FROM nincs_ilyen_tabla')
    },
  }
  await assert.rejects(migrate(pool, [...all, broken]), /9999_broken failed/)
  assert.ok(!(await versions(pool)).includes(9999))
  const leftover = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'half_done'")
  assert.equal(leftover.rowCount, 0)
  // Javítva újra lefut.
  const fixed: Migration = { ...broken, up: async (c) => void (await c.query('CREATE TABLE half_done (id INT)')) }
  assert.deepEqual(await migrate(pool, [...all, fixed]), ['9999_broken'])
})

test('két egyszerre induló folyamat sem futtat semmit kétszer', async () => {
  const pool = await freshSchema()
  const [a, b] = await Promise.all([migrate(pool), migrate(pool)])
  assert.equal(a.length + b.length, all.length)
})
