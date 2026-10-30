// The one-off SQLite import (server/scripts/import-sqlite.ts) with a small database in the old format.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import pg from 'pg'
import { TEST_DATABASE_URL } from './helpers/server.ts'

const dir = mkdtempSync(join(tmpdir(), 'pnw-import-'))
const schema = `i_${randomBytes(6).toString('hex')}`
const admin = new pg.Client({ connectionString: TEST_DATABASE_URL })

after(async () => {
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
  await admin.end()
  rmSync(dir, { recursive: true, force: true })
})

function legacyFile(): string {
  const file = join(dir, 'hirkezelo.db')
  const db = new Database(file)
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, display_name TEXT, password_hash TEXT, role TEXT);
    CREATE TABLE posts (id TEXT PRIMARY KEY, slug TEXT, title TEXT, content TEXT, excerpt TEXT, category_ids TEXT, tag_ids TEXT,
      featured_image TEXT, image_position TEXT, origin TEXT, author_id TEXT, status TEXT, review_note TEXT, last_reviewer_id TEXT,
      last_reviewed_at TEXT, scheduled_for TEXT, scheduled_by_id TEXT, archived_at TEXT, archived_by_id TEXT,
      created_at TEXT, modified_at TEXT, date TEXT);
    CREATE TABLE audit_log (id TEXT PRIMARY KEY, post_id TEXT, user_id TEXT, action TEXT, from_status TEXT, to_status TEXT, note TEXT, created_at TEXT);
  `)
  db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('u1', 'regi.igazgato', 'Régi Igazgató', '$2a$10$x', 'petrik_director')
  db.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    'p1', 'regi-hir', 'Régi Hír', JSON.stringify([{ id: 'b', type: 'paragraph', runs: [{ text: 'Ballagás a Petrikben' }] }]), '', '["c1"]', '[]',
    null, 'top', 'mirror', 'u1', 'publish', null, null, null, null, null, null, null,
    '2020-05-01T10:00:00.000Z', '2020-05-01T10:00:00.000Z', '2020-05-01T10:00:00.000Z',
  )
  db.prepare('INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('a1', 'p1', null, 'imported', '', 'publish', null, '2020-05-01T10:00:00.000Z')
  // Orphans (a deleted account / a permanently deleted post) and an old date without a time zone.
  db.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    'p2', 'arva-hir', 'Árva hír', '[]', '', '[]', '[]', null, 'top', 'mirror', 'torolt-fiok', 'publish', null, null, null, null, null, null, null,
    '2019-03-04 08:30:00', '2019-03-04 08:30:00', '2019-03-04 08:30:00',
  )
  db.prepare('INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('a2', 'torolt-hir', 'torolt-fiok', 'trashed', 'draft', 'trash', null, '2020-01-01T00:00:00.000Z')
  db.close()
  return file
}

test('the rows of the old database are moved over, running it twice does not duplicate them', async () => {
  const file = legacyFile()
  await admin.connect()
  await admin.query(`CREATE SCHEMA ${schema}`)
  const url = new URL(TEST_DATABASE_URL)
  url.searchParams.set('options', `-c search_path=${schema}`)
  const run = () =>
    execFileSync(process.execPath, ['--experimental-strip-types', 'server/scripts/import-sqlite.ts', file], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
    })
  const output = run()
  assert.match(output, /posts: 2 rows in the source, 2 new inserted, 1 orphaned references set to NULL/)
  assert.match(run(), /posts: 2 rows in the source, 0 new inserted/)

  const q = async (sql: string) => (await admin.query(`SET search_path = ${schema}; ${sql}`) as unknown as pg.QueryResult[])[1].rows
  const [user] = await q("SELECT username, permissions FROM users WHERE id = 'u1'")
  assert.equal(user.username, 'regi.igazgato')
  assert.ok((user.permissions as string[]).includes('pnw_review_news'))
  const [post] = await q("SELECT title, status, search_text FROM posts WHERE id = 'p1'")
  assert.equal(post.title, 'Régi Hír')
  assert.match(String(post.search_text), /ballagás a petrikben/)
  const [orphan] = await q("SELECT author_id, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS d FROM posts WHERE id = 'p2'")
  assert.deepEqual(orphan, { author_id: null, d: '2019-03-04 08:30' })
  const audit = await q('SELECT id, post_id, user_id FROM audit_log ORDER BY id')
  assert.deepEqual(audit, [
    { id: 'a1', post_id: 'p1', user_id: null },
    { id: 'a2', post_id: null, user_id: null },
  ])
})
