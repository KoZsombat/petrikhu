/** scripts/backup.sh: a dump it writes restores into an empty database with every table and the media bytes. */
import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import { TEMPLATE_DB, TEST_DATABASE_URL, dbUrl } from './helpers.ts'

const dir = mkdtempSync(join(tmpdir(), 'petrik-backup-'))
const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
const source = `bk_src_${suffix}`
const target = `bk_dst_${suffix}`
const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })

afterAll(async () => {
  for (const db of [source, target]) await admin.unsafe(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  await admin.end()
  rmSync(dir, { recursive: true, force: true })
})

const major = (text: string) => Number(/(\d+)(\.\d+)?/.exec(text)?.[1] ?? 0)

/** pg_dump must exist and not be older than the server (an older client refuses to dump a newer server). */
function pgDumpMajor(): number {
  try {
    return major(Bun.spawnSync(['pg_dump', '--version']).stdout.toString())
  } catch {
    return 0
  }
}

test('dump with backup.sh, restore with pg_restore', async () => {
  const [{ server_version }] = await admin`SHOW server_version`
  if (pgDumpMajor() < major(server_version)) {
    console.warn(`skipped: pg_dump missing or older than the server (${server_version})`)
    return
  }
  await admin.unsafe(`CREATE DATABASE ${source} TEMPLATE ${TEMPLATE_DB}`)
  await admin.unsafe(`CREATE DATABASE ${target}`)
  const src = postgres(dbUrl(source), { max: 1, onnotice: () => {} })
  await src`INSERT INTO users (id, name, email, username) VALUES ('u1', 'Árvíz Tűrő', 'a@x.invalid', 'a')`
  await src`INSERT INTO media (path, mime, size, data) VALUES ('/media/x.bin', 'application/octet-stream', 3, ${Buffer.from([1, 2, 3])})`
  await src.end()

  const url = new URL(dbUrl(source))
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: source,
    PNW_BACKUP_TARGET: dir,
  }
  const run = Bun.spawnSync(['sh', resolve(import.meta.dir, '../../../scripts/backup.sh'), 'once'], { env })
  expect(run.stdout.toString()).toMatch(/wrote .*petrik-\d{8}-\d{6}\.dump/)
  const [file] = readdirSync(dir).filter((name) => name.endsWith('.dump'))
  expect(file).toBeTruthy()

  const restore = Bun.spawnSync(['pg_restore', '--no-owner', '--dbname', target, join(dir, file)], { env: { ...env, PGDATABASE: target } })
  expect(restore.exitCode).toBe(0)
  const restored = postgres(dbUrl(target), { max: 1, onnotice: () => {} })
  expect((await restored`SELECT name FROM users WHERE id = 'u1'`)[0].name).toBe('Árvíz Tűrő')
  expect([...(await restored`SELECT data FROM media WHERE path = '/media/x.bin'`)[0].data]).toEqual([1, 2, 3])
  expect((await restored`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)[0].n).toBeGreaterThanOrEqual(2)
  await restored.end()
})
