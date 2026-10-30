// Az egyszeri SQLite-import (server/scripts/import-sqlite.ts) egy kicsi, régi formátumú adatbázissal.
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
  db.close()
  return file
}

test('a régi adatbázis sorai átkerülnek, kétszer futtatva sem duplikál', async () => {
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
  assert.match(output, /posts: 1 sor a forrásban, 1 új került be/)
  assert.match(run(), /posts: 1 sor a forrásban, 0 új került be/)

  const q = async (sql: string) => (await admin.query(`SET search_path = ${schema}; ${sql}`) as unknown as pg.QueryResult[])[1].rows
  const [user] = await q("SELECT username, permissions FROM users WHERE id = 'u1'")
  assert.equal(user.username, 'regi.igazgato')
  assert.ok(JSON.parse(String(user.permissions)).includes('pnw_review_news'))
  const [post] = await q("SELECT title, status, search_text FROM posts WHERE id = 'p1'")
  assert.equal(post.title, 'Régi Hír')
  assert.match(String(post.search_text), /ballagás a petrikben/)
  assert.equal((await q('SELECT * FROM audit_log')).length, 1)
})
