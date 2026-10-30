// Versioned migrations (server/data/migrate.ts): on an empty and on an old (pre-migration) database too.
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

/** A fresh, empty schema and a connection pointing to it. */
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

test('the migration file numbers are unique and increasing', () => {
  assert.ok(all.length >= 1)
  assert.equal(all[0].version, 1)
  for (let i = 1; i < all.length; i += 1) assert.ok(all[i].version > all[i - 1].version)
})

test('on an empty database it runs all of them, the second time nothing', async () => {
  const pool = await freshSchema()
  assert.equal((await migrate(pool)).length, all.length)
  assert.deepEqual(await versions(pool), all.map((m) => m.version))
  assert.deepEqual(await migrate(pool), [])
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()")).rows.map((r) => r.table_name)
  for (const table of ['posts', 'users', 'creator_pages', 'audit_log', 'media_files', 'sessions']) assert.ok(tables.includes(table), table)
})

test('starts on a pre-migration database and keeps the data', async () => {
  const pool = await freshSchema()
  // The old db.ts schema: 001 ran exactly this on every startup, without schema_migrations.
  const client = await pool.connect()
  await all[0].up(client)
  client.release()
  await pool.query("INSERT INTO users (id, username, display_name, password_hash) VALUES ('u1', 'regi', 'Régi Fiók', 'x')")
  await migrate(pool)
  assert.deepEqual(await versions(pool), all.map((m) => m.version))
  assert.equal((await pool.query("SELECT display_name FROM users WHERE id = 'u1'")).rows[0].display_name, 'Régi Fiók')
})

test('a broken migration is rolled back and not recorded', async () => {
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
  // Once fixed, it runs again.
  const fixed: Migration = { ...broken, up: async (c) => void (await c.query('CREATE TABLE half_done (id INT)')) }
  assert.deepEqual(await migrate(pool, [...all, fixed]), ['9999_broken'])
})

test('two processes starting at once do not run anything twice', async () => {
  const pool = await freshSchema()
  const [a, b] = await Promise.all([migrate(pool), migrate(pool)])
  assert.equal(a.length + b.length, all.length)
})

/** The schema in the 001-003 state (with the text columns from before 004). */
async function beforeTyped(): Promise<pg.Pool> {
  const pool = await freshSchema()
  await migrate(pool, all.filter((m) => m.version < 4))
  return pool
}

test('004: old-format data is converted, the orphan references become NULL', async () => {
  const pool = await beforeTyped()
  await pool.query("INSERT INTO users (id, username, display_name, password_hash, permissions) VALUES ('u1', 'a', 'A', 'x', '[\"pnw_submit_news\"]')")
  const post = (id: string, author: string, date: string) =>
    pool.query(
      `INSERT INTO posts (id, slug, title, content, category_ids, author_id, status, created_at, modified_at, date)
       VALUES ($1, $1, 'Cím', '[{"id":"b","type":"paragraph","runs":[{"text":"x"}]}]', '["c1"]', $2, 'publish', $3, $3, $3)`,
      [id, author, date],
    )
  await post('p1', 'u1', '2026-01-02T03:04:05.678Z')
  await post('p2', 'torolt', '2019-03-04 08:30:00')
  await pool.query("INSERT INTO audit_log (id, post_id, user_id, action, from_status, to_status, created_at) VALUES ('a1', 'nincs', 'torolt', 'trashed', '', 'trash', '2020-01-01T00:00:00Z')")
  await pool.query("INSERT INTO creator_pages (id, slug, title, blocks, status, deleted, author_id, created_at, modified_at) VALUES ('c1', 'x', 'X', '[]', 'draft', 1, 'u1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')")

  await migrate(pool)

  const types = (await pool.query(
    "SELECT table_name || '.' || column_name AS col, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND column_name IN ('content', 'date', 'deleted', 'permissions', 'blocks', 'created_at')",
  )).rows
  const typeOf = (col: string) => types.find((t) => t.col === col)?.data_type
  assert.equal(typeOf('posts.content'), 'jsonb')
  assert.equal(typeOf('posts.date'), 'timestamp with time zone')
  assert.equal(typeOf('creator_pages.deleted'), 'boolean')
  assert.equal(typeOf('creator_pages.blocks'), 'jsonb')
  assert.equal(typeOf('users.permissions'), 'jsonb')
  assert.equal(typeOf('audit_log.created_at'), 'timestamp with time zone')

  const posts = (await pool.query("SELECT id, author_id, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS') AS d, content->0->>'type' AS t FROM posts ORDER BY id")).rows
  assert.deepEqual(posts, [
    { id: 'p1', author_id: 'u1', d: '2026-01-02T03:04:05.678', t: 'paragraph' },
    { id: 'p2', author_id: null, d: '2019-03-04T08:30:00.000', t: 'paragraph' },
  ])
  assert.deepEqual((await pool.query('SELECT post_id, user_id FROM audit_log')).rows, [{ post_id: null, user_id: null }])
  assert.equal((await pool.query("SELECT deleted FROM creator_pages WHERE id = 'c1'")).rows[0].deleted, true)
  // The foreign key is active: when an account is deleted the reference becomes NULL, the post stays.
  await pool.query("DELETE FROM users WHERE id = 'u1'")
  assert.equal((await pool.query("SELECT author_id FROM posts WHERE id = 'p1'")).rows[0].author_id, null)
  await assert.rejects(pool.query("INSERT INTO audit_log (id, post_id, action, from_status, to_status, created_at) VALUES ('a2', 'nincs', 'x', '', '', now())"), /foreign key/)
})

test('004: an unconvertible value stops with a readable error, and nothing changes', async () => {
  const pool = await beforeTyped()
  await pool.query("INSERT INTO terms (id, kind, name, created_at) VALUES ('t1', 'tag', 'X', 'tegnap délután')")
  await assert.rejects(migrate(pool), /terms\.created_at \(t1\): "tegnap délután" not timestamptz/)
  assert.ok(!(await versions(pool)).includes(4))
  const type = (await pool.query("SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'posts' AND column_name = 'date'")).rows[0]
  assert.equal(type.data_type, 'text')
})
