/**
 * The legacy migration against a database created by the previous app (test/fixtures/legacy-v5.sql, made
 * with the old code and its API), then the new app on the result.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { blocksSchema } from '@petrik/shared/blocks'
import { createApp, createDeps } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { createDb } from '../src/db/client.ts'
import type { Db } from '../src/db/client.ts'
import { auditLog, documents, documentTerms, terms, users } from '../src/db/schema.ts'
import { migrateLegacy, roleForPermissions, uuidFor } from '../src/lib/legacy-migration.ts'
import type { MigrationReport } from '../src/lib/legacy-migration.ts'
import { Client, TEMPLATE_DB, TEST_DATABASE_URL, dbUrl } from './helpers.ts'

const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
const OLD = `legacy_${suffix}`
const NEW = `migrated_${suffix}`
let admin: postgres.Sql
let old: postgres.Sql
let target: { db: Db; sql: postgres.Sql }
let report: MigrationReport

beforeAll(async () => {
  admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
  await admin.unsafe(`CREATE DATABASE ${OLD}`)
  await admin.unsafe(`CREATE DATABASE ${NEW} TEMPLATE ${TEMPLATE_DB}`)
  old = postgres(dbUrl(OLD), { max: 2, onnotice: () => {} })
  await old.unsafe(await Bun.file(new URL('./fixtures/legacy-v5.sql', import.meta.url)).text())
  target = createDb(dbUrl(NEW))
  report = await migrateLegacy(old, target.db)
})

afterAll(async () => {
  await old.end()
  await target.sql.end()
  await admin.unsafe(`DROP DATABASE IF EXISTS ${OLD} WITH (FORCE)`)
  await admin.unsafe(`DROP DATABASE IF EXISTS ${NEW} WITH (FORCE)`)
  await admin.end()
})

const oldCount = async (table: string) => Number((await old.unsafe(`SELECT count(*)::int AS n FROM ${table}`))[0].n)

describe('rows', () => {
  test('every account, post, page, term, audit entry and media file arrives', async () => {
    const { db, sql } = target
    const count = async (table: string, where = 'true') => Number((await sql.unsafe(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))[0].n)
    expect(await count('users')).toBe(await oldCount('users'))
    expect(await count('documents', "type = 'post'")).toBe(await oldCount('posts'))
    expect(await count('terms')).toBe(await oldCount('terms'))
    expect(await count('audit_log')).toBe(await oldCount('audit_log'))
    expect(await count('media')).toBe(await oldCount('media_files'))
    const oldPages = await old`SELECT slug FROM creator_pages`
    for (const { slug } of oldPages) {
      const found = await db.select().from(documents).where(eq(documents.slug, slug))
      const renamed = await db.select().from(documents).where(eq(documents.slug, `${slug}-regi`))
      expect(found.length + renamed.length).toBeGreaterThan(0)
    }
  })

  test('statuses are mapped', async () => {
    const statusOf = async (title: string) => (await target.db.select().from(documents).where(eq(documents.title, title)))[0]
    expect((await statusOf('Beküldött hír')).status).toBe('in_review')
    expect((await statusOf('Beküldött hír')).submittedAt).not.toBeNull()
    const rejected = await statusOf('Visszaküldött hír')
    expect(rejected.status).toBe('draft')
    expect(rejected.reviewNote).toBe('Kérlek javítsd a címet.')
    expect((await statusOf('Publikált hír')).status).toBe('published')
    const scheduled = await statusOf('Időzített hír')
    expect(scheduled.status).toBe('scheduled')
    expect(scheduled.scheduledFor!.getTime()).toBeGreaterThan(Date.now())
    expect((await statusOf('Archivált hír')).status).toBe('archived')
    expect((await statusOf('Lomtár hír')).status).toBe('trash')
    expect((await statusOf('Piszkozat hír')).status).toBe('in_review')
    expect((await statusOf('Sima piszkozat')).status).toBe('draft')
  })

  test('permissions become roles (smallest covering role)', async () => {
    const roleOf = async (username: string) => (await target.db.select().from(users).where(eq(users.username, username)))[0].role
    expect(await roleOf('mk.vezeto')).toBe('author')
    expect(await roleOf('igazgato')).toBe('admin')
    expect(await roleOf('szerkeszto')).toBe('editor')
    expect(await roleOf('ures')).toBe('inactive')
    expect(await roleOf('cimkes')).toBe('reviewer')
    expect(roleForPermissions(['pnw_review_news', 'pnw_view_audit_log'])).toBe('reviewer')
  })

  test('content becomes valid TipTap blocks, with formatting, lists, tables and media nodes', async () => {
    const rows = await target.db.select().from(documents)
    for (const row of rows) expect({ slug: row.slug, ok: blocksSchema.safeParse(row.blocks).success }).toEqual({ slug: row.slug, ok: true })
    const legacy = rows.find((r) => r.slug === 'regi-hir')!
    expect(legacy.legacy).toBe(true)
    const types = JSON.stringify(legacy.blocks)
    for (const node of ['"image"', '"gallery"', '"embed"', 'Képaláírás']) expect(types).toContain(node)
    const post = JSON.stringify(rows.find((r) => r.title === 'Publikált hír')!.blocks)
    for (const part of ['"heading"', '"bold"', '"link"', '"textStyle"', '"bulletList"', '"orderedList"', '"blockquote"', '"tableHeader"', '"hardBreak"']) expect(post).toContain(part)
    const page = rows.find((r) => r.slug === 'teszt-oldal')!
    expect(page.blocks.map((b) => b.type)).toEqual(['pageTitle', 'richText', 'accordion', 'callout', 'rows'])
    expect(JSON.stringify(page.blocks)).not.toContain('<p>')
  })

  test('pages: the published override wins, a trashed one stays in the trash, categories and post terms arrive', async () => {
    const bemutatkozas = (await target.db.select().from(documents).where(eq(documents.slug, 'bemutatkozas')))[0]
    expect(bemutatkozas.title).toBe('Bemutatkozás (szerkesztett)')
    expect((await target.db.select().from(documents).where(eq(documents.slug, 'piszkozat-oldal')))[0].status).toBe('trash')
    const child = (await target.db.select().from(terms).where(eq(terms.id, '/kategoria/oktatas/esti-munkarend/')))[0]
    expect(child.parentId).toBe('/kategoria/oktatas/')
    const post = (await target.db.select().from(documents).where(eq(documents.title, 'Publikált hír')))[0]
    expect((await target.db.select().from(documentTerms).where(eq(documentTerms.documentId, post.id))).length).toBe(1)
    expect((await target.db.select().from(documents).where(eq(documents.slug, 'elerhetoseg'))).length).toBe(1)
  })

  test('audit entries keep their post, with mapped statuses', async () => {
    const mirror = await target.db.select().from(auditLog).where(eq(auditLog.entityId, uuidFor('post', 'mirror-1')))
    expect(mirror.map((e) => e.action)).toEqual(['imported'])
    const statuses = (await target.db.select().from(auditLog)).flatMap((e) => [e.fromStatus, e.toStatus])
    for (const old of ['pending', 'publish', 'pnw_revision', 'future']) expect(statuses).not.toContain(old)
  })

  test('menu and library come over', async () => {
    const [menu] = await target.sql`SELECT value FROM settings WHERE key = 'menu.hu'`
    expect(menu.value[2].children[1]).toEqual({ label: 'Teszt', href: '/teszt-oldal' })
    const [library] = await target.sql`SELECT value FROM settings WHERE key = 'library'`
    expect(library.value.categories[0].docs[1]).toEqual({ slug: 'vedett', title: 'Védett dok' })
  })

  test('report lists every account with its new role', () => {
    expect(report.users.map((u) => u.username).sort()).toEqual(['cimkes', 'helyettes', 'igazgato', 'mk.vezeto', 'szerkeszto', 'ures'])
  })
})

test('running it a second time changes nothing and duplicates nothing', async () => {
  const snapshot = async () => ({
    documents: (await target.sql`SELECT id, slug, status, title, blocks::text FROM documents ORDER BY id`),
    users: await target.sql`SELECT id, username, role FROM users ORDER BY id`,
    audit: await target.sql`SELECT count(*)::int AS n FROM audit_log`,
    media: await target.sql`SELECT count(*)::int AS n FROM media`,
    terms: await target.sql`SELECT count(*)::int AS n FROM document_terms`,
  })
  const before = await snapshot()
  await migrateLegacy(old, target.db)
  expect(await snapshot()).toEqual(before)
})

test('the new app works on the migrated data: old passwords log in, public pages and posts are served', async () => {
  const app = createApp(createDeps(target.db, loadConfig({ trustProxy: 0, allowedOrigins: [], publicUrl: '', secureCookies: false })))
  const server = Bun.serve({ port: 0, fetch: app.fetch })
  try {
    const client = new Client(`http://127.0.0.1:${server.port}`)
    expect((await client.post('/api/auth/login', { username: 'szerkeszto', password: 'SzerkesztoJelszo1' })).status).toBe(200)
    const [hash] = await target.sql`SELECT a.password FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.username = 'szerkeszto'`
    expect(hash.password).toStartWith('$argon2id$')
    expect((await client.get('/api/pages?locale=hu')).status).toBe(200)
    expect((await client.get('/api/public/posts/publikalt-hir')).status).toBe(200)
    expect((await client.get('/api/public/posts/regi-hir')).body.post.legacy).toBeUndefined()
    expect((await client.get('/api/public/resolve/regi-hir')).body).toEqual({ kind: 'post', redirect: '/hirek/regi-hir' })
    expect((await client.get('/api/public/pages/hu/teszt-oldal')).status).toBe(200)
    expect((await client.get('/media/wp-content/uploads/2019/05/kep.jpg')).status).toBe(200)
  } finally {
    await server.stop(true)
  }
})
