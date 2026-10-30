// scripts/backup.sh: a dump it writes restores into an empty database with every table and the media bytes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { TEST_DATABASE_URL } from './helpers/server.ts'
import { migrate } from '../server/data/migrate.ts'

const dir = mkdtempSync(join(tmpdir(), 'pnw-backup-'))
const suffix = randomBytes(4).toString('hex')
const source = `bk_src_${suffix}`
const target = `bk_dst_${suffix}`
const admin = new pg.Client({ connectionString: TEST_DATABASE_URL })

function major(output: string): number {
  return Number(/(\d+)(\.\d+)?/.exec(output)?.[1] ?? 0)
}

/** pg_dump must exist and not be older than the server (an older client refuses to dump a newer server). */
function canDump(serverMajor: number): boolean {
  try {
    return major(execFileSync('pg_dump', ['--version'], { encoding: 'utf8' })) >= serverMajor
  } catch {
    return false
  }
}

after(async () => {
  for (const db of [source, target]) await admin.query(`DROP DATABASE IF EXISTS ${db}`).catch(() => undefined)
  await admin.end()
  rmSync(dir, { recursive: true, force: true })
})

const urlOf = (db: string) => {
  const url = new URL(TEST_DATABASE_URL)
  url.pathname = `/${db}`
  return url
}

test('dump with backup.sh, restore with pg_restore', async (t) => {
  await admin.connect()
  const serverMajor = major((await admin.query('SHOW server_version')).rows[0].server_version)
  if (!canDump(serverMajor)) {
    t.skip(`pg_dump missing or older than the server (${serverMajor})`)
    return
  }
  await admin.query(`CREATE DATABASE ${source}`)
  await admin.query(`CREATE DATABASE ${target}`)
  const pool = new pg.Pool({ connectionString: urlOf(source).toString(), max: 2 })
  await migrate(pool)
  await pool.query("INSERT INTO users (id, username, display_name, password_hash) VALUES ('u1', 'a', 'Árvíz Tűrő', 'x')")
  await pool.query("INSERT INTO media_files (path, mime, size, modified_at, data) VALUES ('/media/x.bin', 'application/octet-stream', 3, now(), '\\x010203')")
  await pool.end()

  const url = urlOf(source)
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: source,
    PNW_BACKUP_TARGET: dir,
  }
  const output = execFileSync('sh', [new URL('../scripts/backup.sh', import.meta.url).pathname, 'once'], { env, encoding: 'utf8' })
  assert.match(output, /wrote .*petrik-\d{8}-\d{6}\.dump/)
  const [file] = readdirSync(dir).filter((name) => name.endsWith('.dump'))
  assert.ok(file)

  execFileSync('pg_restore', ['--no-owner', '--dbname', target, join(dir, file)], { env: { ...env, PGDATABASE: target } })
  const restored = new pg.Client({ connectionString: urlOf(target).toString() })
  await restored.connect()
  assert.equal((await restored.query("SELECT display_name FROM users WHERE id = 'u1'")).rows[0].display_name, 'Árvíz Tűrő')
  assert.deepEqual([...(await restored.query("SELECT data FROM media_files WHERE path = '/media/x.bin'")).rows[0].data], [1, 2, 3])
  assert.ok((await restored.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n >= 5)
  await restored.end()
})
