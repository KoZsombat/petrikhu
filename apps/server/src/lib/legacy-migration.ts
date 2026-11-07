/**
 * Moves the previous app's database (tables creator_pages, posts, audit_log, users, terms, site_menu,
 * site_library, media_files, sessions; schema version 5) into the new schema. Run it with
 * `bun run migrate:legacy` (src/scripts/migrate-legacy.ts); the steps are in PR_DESCRIPTION.md / README.md.
 *
 * Idempotent: every row is upserted by its (mapped) id or path, so a second run changes nothing and creates
 * no duplicates; rows created in the new app are left alone. Sessions are not copied: everyone logs in again.
 *
 * Mappings (documented in README.md "Migrating from the old app"):
 *   statuses: draft → draft, pending → in_review, pnw_revision → draft (review note kept),
 *             pnw_test_ok → in_review, publish → published, future → scheduled, pnw_archived → archived, trash → trash
 *   permissions → the smallest role holding all of them (roles.ts `smallestRoleCovering`); none → inactive
 *   content: blocks-and-runs posts and sanitized-HTML page fields → TipTap JSON
 */
import { createHash } from 'node:crypto'
import { sql as dsql } from 'drizzle-orm'
import type postgres from 'postgres'
import type { Capability, Role } from '@petrik/shared/roles'
import { smallestRoleCovering } from '@petrik/shared/roles'
import { librarySchema, menuSchema } from '@petrik/shared/schemas'
import { isReservedSlug } from '@petrik/shared/slug'
import type { Db } from '../db/client.ts'
import { accounts, auditLog, documents, documentTerms, terms, users } from '../db/schema.ts'
import { excerptOf, postBlocks, searchTextOf } from './documents.ts'
import { convertPageBlocks, runsToTiptap } from './legacy-content.ts'
import { putMediaIfMissing } from './media.ts'
import { getSetting, putSetting, seed } from './seed.ts'
import { placeholderEmail } from './users.ts'

export const STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  pending: 'in_review',
  pnw_revision: 'draft',
  pnw_test_ok: 'in_review',
  publish: 'published',
  future: 'scheduled',
  pnw_archived: 'archived',
  trash: 'trash',
}

export const PERMISSION_MAP: Record<string, Capability> = {
  pnw_submit_news: 'news.write',
  pnw_review_news: 'news.review',
  pnw_manage_published_news: 'news.manage',
  pnw_view_audit_log: 'audit.view',
  pnw_manage_users: 'users.manage',
  pnw_manage_terms: 'terms.create',
  pnw_manage_pages: 'pages.manage',
  pnw_manage_library: 'library.manage',
}

export function roleForPermissions(permissions: unknown): Role {
  const list = Array.isArray(permissions) ? permissions : []
  return smallestRoleCovering(list.map((p) => PERMISSION_MAP[String(p)]).filter((c): c is Capability => !!c))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The old id if it is a uuid, otherwise a stable uuid derived from it (the same on every run). */
export function uuidFor(kind: string, id: string): string {
  if (UUID.test(id)) return id.toLowerCase()
  const hex = createHash('sha256').update(`${kind}:${id}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const date = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}
const json = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export type MigrationReport = {
  users: { username: string; permissions: string[]; role: Role }[]
  counts: Record<string, number>
  renamedPages: string[]
  issues: string[]
}

export async function migrateLegacy(old: postgres.Sql, db: Db, options: { media?: boolean; log?: (line: string) => void } = {}): Promise<MigrationReport> {
  const log = options.log ?? (() => {})
  const report: MigrationReport = { users: [], counts: {}, renamedPages: [], issues: [] }
  const count = (key: string, n = 1) => (report.counts[key] = (report.counts[key] ?? 0) + n)

  const [{ version }] = await old`SELECT COALESCE(MAX(version), 0)::int AS version FROM schema_migrations`.catch(() => [{ version: 0 }])
  if (version < 5) throw new Error(`the old database is at schema version ${version}; start the old app once to bring it to version 5, then run this again`)

  /* users ------------------------------------------------------------------------------------- */
  const oldUsers = await old`SELECT id, username, display_name, password_hash, permissions FROM users ORDER BY username`
  const userIds = new Set<string>()
  for (const u of oldUsers) {
    const permissions = (json(u.permissions) as string[] | null) ?? []
    const role = roleForPermissions(permissions)
    const username = String(u.username).trim().toLowerCase()
    report.users.push({ username, permissions, role })
    await db
      .insert(users)
      .values({ id: u.id, name: u.display_name, email: placeholderEmail(username), username, displayUsername: String(u.username).trim(), role })
      .onConflictDoUpdate({ target: users.id, set: { name: u.display_name, username, displayUsername: String(u.username).trim(), role, email: placeholderEmail(username) } })
    await db
      .insert(accounts)
      .values({ id: uuidFor('account', u.id), accountId: u.id, providerId: 'credential', userId: u.id, password: u.password_hash })
      .onConflictDoUpdate({ target: accounts.id, set: { password: u.password_hash } })
    userIds.add(u.id)
    count('users')
  }
  const userRef = (id: unknown) => (typeof id === 'string' && userIds.has(id) ? id : null)
  log(`users: ${oldUsers.length}`)

  /* terms (parents from the old archive routes: /kategoria/a/b/ is a child of /kategoria/a/) ------------------- */
  const oldTerms = await old`SELECT id, kind, name, route, created_at, created_by_id FROM terms`
  const byRoute = new Map(oldTerms.filter((t) => t.route).map((t) => [String(t.route), String(t.id)]))
  const parentOf = (route: string | null): string | null => {
    if (!route) return null
    const parts = route.replace(/\/+$/, '').split('/')
    for (let n = parts.length - 1; n > 2; n -= 1) {
      const candidate = byRoute.get(`${parts.slice(0, n).join('/')}/`)
      if (candidate) return candidate
    }
    return null
  }
  for (const t of oldTerms) {
    const values = { id: t.id, kind: t.kind === 'tag' ? ('tag' as const) : ('category' as const), name: t.name, createdAt: date(t.created_at) ?? new Date(), createdById: userRef(t.created_by_id) }
    await db.insert(terms).values(values).onConflictDoUpdate({ target: terms.id, set: { name: values.name, kind: values.kind } }).catch(async (error) => {
      // Same name as a term the new app already has: keep the new one, point the old id's posts at it below.
      report.issues.push(`term ${t.id} (${t.name}): ${(error as Error).message}`)
    })
    count('terms')
  }
  for (const t of oldTerms) await db.update(terms).set({ parentId: parentOf(t.route) }).where(dsql`${terms.id} = ${t.id}`)
  const termIds = new Set((await db.select({ id: terms.id }).from(terms)).map((t) => t.id))

  /* posts ---------------------------------------------------------------------------------------------- */
  const submitted = new Map(
    (await old`SELECT post_id, MAX(created_at) AS at FROM audit_log WHERE action = 'submitted' AND post_id IS NOT NULL GROUP BY post_id`).map((r) => [String(r.post_id), date(r.at)]),
  )
  const postIdMap = new Map<string, string>()
  const oldPosts = await old`SELECT * FROM posts ORDER BY created_at`
  for (const p of oldPosts) {
    const id = uuidFor('post', p.id)
    postIdMap.set(p.id, id)
    const status = STATUS_MAP[p.status] ?? 'draft'
    if (!STATUS_MAP[p.status]) report.issues.push(`post ${p.slug}: unknown status ${p.status} → draft`)
    const content = runsToTiptap(json(p.content))
    const blocks = postBlocks(content)
    const shown = status === 'published' || status === 'scheduled' || status === 'archived' || status === 'trash'
    const values = {
      id,
      type: 'post' as const,
      slug: p.slug,
      locale: 'hu' as const,
      title: p.title,
      description: p.excerpt ?? '',
      blocks,
      status,
      authorId: userRef(p.author_id),
      updatedById: null,
      createdAt: date(p.created_at) ?? new Date(),
      updatedAt: date(p.modified_at) ?? new Date(),
      publishedAt: shown ? date(p.date) : null,
      searchText: searchTextOf(p.title, blocks),
      legacy: p.origin === 'mirror',
      featuredImage: p.featured_image || null,
      imagePosition: p.image_position === 'bottom' ? ('bottom' as const) : ('top' as const),
      submittedAt: status === 'in_review' ? (submitted.get(p.id) ?? date(p.modified_at)) : null,
      reviewNote: p.review_note || null,
      reviewedById: userRef(p.last_reviewer_id),
      reviewedAt: date(p.last_reviewed_at),
      scheduledFor: status === 'scheduled' ? (date(p.scheduled_for) ?? date(p.date)) : null,
      scheduledById: userRef(p.scheduled_by_id),
      archivedAt: date(p.archived_at),
      archivedById: userRef(p.archived_by_id),
    }
    const { id: _id, ...updatable } = values
    await db.insert(documents).values(values).onConflictDoUpdate({ target: documents.id, set: updatable })
    const ids = [...((json(p.category_ids) as string[] | null) ?? []), ...((json(p.tag_ids) as string[] | null) ?? [])].filter((t) => termIds.has(t))
    await db.delete(documentTerms).where(dsql`${documentTerms.documentId} = ${id}`)
    const unique = [...new Set(ids)]
    if (unique.length) await db.insert(documentTerms).values(unique.map((termId, position) => ({ documentId: id, termId, position })))
    if (!values.description && status === 'published' && !excerptOf(content)) report.issues.push(`post ${p.slug}: no text`)
    count(`posts.${status}`)
  }
  log(`posts: ${oldPosts.length}`)

  /* pages ------------------------------------------------------------------------------------------------- */
  const builtIn = new Set(Object.keys(await Bun.file(new URL('../../seed/pages.hu.json', import.meta.url)).json()).concat('dokumentumtar'))
  const oldPages = await old`SELECT * FROM creator_pages ORDER BY created_at`
  for (const p of oldPages) {
    const id = uuidFor('page', p.id)
    const status = p.deleted ? 'trash' : p.status === 'publish' ? 'published' : 'draft'
    let slug = String(p.slug)
    // An unpublished edit of a built-in page must not hide the built-in page; a reserved slug cannot be used at all.
    if ((builtIn.has(slug) && status !== 'published') || isReservedSlug(slug)) {
      const renamed = `${slug}-regi`
      report.renamedPages.push(`/${slug} → /${renamed} (${status})`)
      slug = renamed
    }
    const { blocks, issues } = convertPageBlocks(json(p.blocks), (index) => `b${index + 1}`)
    issues.forEach((issue) => report.issues.push(`page /${slug}: ${issue.component} #${issue.index}: ${issue.message}`))
    const finalBlocks = blocks.length ? blocks : [{ id: 'empty', type: 'richText' as const, props: { content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] } } }]
    const values = {
      id,
      type: 'page' as const,
      slug,
      locale: 'hu' as const,
      title: p.title,
      description: p.description ?? '',
      blocks: finalBlocks,
      status,
      authorId: userRef(p.author_id),
      updatedById: userRef(p.modified_by_id),
      createdAt: date(p.created_at) ?? new Date(),
      updatedAt: date(p.modified_at) ?? new Date(),
      publishedAt: status === 'published' ? date(p.modified_at) : null,
      searchText: searchTextOf(p.title, finalBlocks),
    }
    const { id: _id, ...updatable } = values
    await db.insert(documents).values(values).onConflictDoUpdate({ target: documents.id, set: updatable })
    count(`pages.${status}`)
  }
  log(`pages: ${oldPages.length}`)

  /* menu and library -------------------------------------------------------------------------------------------- */
  const [menuRow] = await old`SELECT data FROM site_menu WHERE id = 1`
  if (menuRow) {
    const menu = menuSchema.safeParse(json(menuRow.data))
    if (menu.success) await putSetting(db, 'menu.hu', menu.data)
    else report.issues.push(`menu: not valid any more (${menu.error.issues[0]?.message}); the default menu is used`)
    count('menu')
  }
  const [libraryRow] = await old`SELECT data FROM site_library WHERE id = 1`
  if (libraryRow) {
    const library = librarySchema.safeParse(json(libraryRow.data))
    if (library.success) await putSetting(db, 'library', library.data)
    else report.issues.push(`library: not valid any more (${library.error.issues[0]?.message}); the default library is used`)
    count('library')
  }

  /* audit log ------------------------------------------------------------------------------------------------------- */
  const oldAudit = await old`SELECT * FROM audit_log ORDER BY created_at`
  const pageIds = new Map(oldPages.map((p) => [String(p.id), uuidFor('page', p.id)]))
  for (const a of oldAudit) {
    const entityType = a.entity_type ?? 'post'
    const rawEntity = a.entity_id ?? a.post_id
    const entityId = rawEntity ? (entityType === 'post' ? (postIdMap.get(rawEntity) ?? uuidFor('post', rawEntity)) : entityType === 'page' ? (pageIds.get(rawEntity) ?? rawEntity) : rawEntity) : null
    const subject = a.subject ?? oldPosts.find((p) => p.id === a.post_id)?.title ?? null
    await db
      .insert(auditLog)
      .values({
        id: uuidFor('audit', a.id),
        createdAt: date(a.created_at) ?? new Date(),
        userId: userRef(a.user_id),
        entityType,
        entityId,
        subject,
        action: a.action,
        fromStatus: a.from_status ? (STATUS_MAP[a.from_status] ?? a.from_status) : null,
        toStatus: a.to_status ? (STATUS_MAP[a.to_status] ?? a.to_status) : null,
        note: a.note ?? null,
      })
      .onConflictDoNothing()
    count('audit')
  }
  log(`audit entries: ${oldAudit.length}`)

  /* media (one file at a time: the table can be > 1 GB) ------------------------------------------------------------------- */
  if (options.media !== false) {
    const paths = await old`SELECT path FROM media_files ORDER BY path`
    let added = 0
    for (const { path } of paths) {
      const [file] = await old`SELECT data, modified_at FROM media_files WHERE path = ${path}`
      if (await putMediaIfMissing(db, path, Buffer.from(file.data), date(file.modified_at) ?? undefined)) added += 1
    }
    report.counts.media = paths.length
    report.counts['media.added'] = added
    log(`media: ${paths.length} files (${added} new)`)
  }

  /* the built-in pages, menus and library where the old data did not provide them -------------------------------------- */
  await seed(db)
  if (!(await getSetting(db, 'migrated'))) await putSetting(db, 'migrated', { at: new Date().toISOString() })
  return report
}
