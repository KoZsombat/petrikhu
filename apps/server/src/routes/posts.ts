/**
 * The news workflow. draft → in_review → scheduled / published → archived; trash with restore (as a draft).
 * A reviewer approves (now or scheduled) or rejects with a message: the post goes back to its author as a
 * draft with `reviewNote`, which disappears when it is resubmitted.
 */
import { Hono } from 'hono'
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { can } from '@petrik/shared/roles'
import { postSaveBody, reviewDecisionBody } from '@petrik/shared/schemas'
import { uniqueSlug } from '@petrik/shared/slug'
import { isEmptyDoc } from '@petrik/shared/tiptap'
import { POST_STATUSES, canEditPost, canTrashPost, canViewPost } from '@petrik/shared/workflow'
import type { PostStatus } from '@petrik/shared/workflow'
import type { AppEnv } from '../context.ts'
import { requireUser, userOf } from '../context.ts'
import type { Db } from '../db/client.ts'
import { documents } from '../db/schema.ts'
import { listAudit, logAudit } from '../lib/audit.ts'
import type { DocumentRow } from '../lib/documents.ts'
import { countSql, existingTermIds, findDocument, likePattern, postBlocks, searchTextOf, setTerms, slugsOf, termIdsOf, toPost, toPostSummary } from '../lib/documents.ts'
import { validate } from '../lib/validate.ts'

const posts = new Hono<AppEnv>()
posts.use(requireUser)

const isPost = eq(documents.type, 'post')

async function summaries(db: Db, rows: DocumentRow[]) {
  const termIds = await termIdsOf(db, rows.map((r) => r.id))
  return rows.map((row) => toPostSummary(row, termIds.get(row.id)))
}

async function loadPost(db: Db, id: string) {
  const row = await findDocument(db, id)
  return row?.type === 'post' ? row : undefined
}

async function full(db: Db, row: DocumentRow) {
  return toPost(row, (await termIdsOf(db, [row.id])).get(row.id))
}

const select = (db: Db, where: SQL | undefined, order: SQL[], limit?: number) => {
  const query = db.select().from(documents).where(and(isPost, where)).orderBy(...order)
  return limit ? query.limit(limit) : query
}

/* --- dashboard and lists ----------------------------------------------------------------------- */

posts.get('/dashboard', async (c) => {
  const user = userOf(c)
  const db = c.var.db
  const countBy = async (where?: SQL) =>
    Object.fromEntries(
      (await db.select({ status: documents.status, n: countSql }).from(documents).where(and(isPost, where)).groupBy(documents.status)).map((r) => [r.status, r.n]),
    ) as Partial<Record<PostStatus, number>>

  if (!can(user, 'news.review')) {
    const own = eq(documents.authorId, user.id)
    const [counts, mine, trash] = await Promise.all([
      countBy(own),
      select(db, and(own, sql`${documents.status} <> 'trash'`), [desc(documents.updatedAt)]),
      select(db, and(own, eq(documents.status, 'trash')), [desc(documents.updatedAt)]),
    ])
    return c.json({ view: 'author', counts, posts: await summaries(db, mine), trash: await summaries(db, trash) })
  }

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const [counts, queue, own, scheduled, recent, trash, [{ rejected }], [{ today }]] = await Promise.all([
    countBy(),
    select(db, eq(documents.status, 'in_review'), [asc(documents.submittedAt), asc(documents.updatedAt)]),
    select(db, and(eq(documents.authorId, user.id), eq(documents.status, 'draft')), [desc(documents.updatedAt)]),
    select(db, eq(documents.status, 'scheduled'), [asc(documents.scheduledFor)], 10),
    select(db, inArray(documents.status, ['published', 'scheduled']), [desc(documents.updatedAt)], 10),
    select(db, eq(documents.status, 'trash'), [desc(documents.updatedAt)], 30),
    db.select({ rejected: countSql }).from(documents).where(and(isPost, eq(documents.status, 'draft'), isNotNull(documents.reviewNote))),
    db.select({ today: countSql }).from(documents).where(and(isPost, eq(documents.status, 'published'), gte(documents.publishedAt, startOfDay))),
  ])
  return c.json({
    view: 'reviewer',
    counts,
    rejectedCount: rejected,
    publishedToday: today,
    queue: await summaries(db, queue),
    own: await summaries(db, own),
    scheduled: await summaries(db, scheduled),
    recent: await summaries(db, recent),
    trash: await summaries(db, trash),
  })
})

const PER_PAGE = 30

/** `?status=published|archived|in_review|trash|draft|scheduled&q=&page=` - newest first, searched in SQL. */
posts.get('/', async (c) => {
  const user = userOf(c)
  const status = c.req.query('status') as PostStatus
  if (!(POST_STATUSES as readonly string[]).includes(status)) return c.json({ error: 'invalid_status' }, 422)
  const reviewer = can(user, 'news.review')
  const manager = can(user, 'news.manage')
  let scope: SQL | undefined
  if ((status === 'published' || status === 'archived') && !manager && !reviewer) scope = eq(documents.authorId, user.id)
  else if ((status === 'in_review' || status === 'draft' || status === 'scheduled' || status === 'trash') && !reviewer) scope = eq(documents.authorId, user.id)
  if (!can(user, 'news.write') && !reviewer && !manager) return c.json({ error: 'forbidden' }, 403)

  const q = (c.req.query('q') ?? '').trim().slice(0, 200)
  const page = Math.max(1, Math.floor(Number(c.req.query('page'))) || 1)
  const where = and(isPost, eq(documents.status, status), scope, q ? sql`${documents.searchText} LIKE ${likePattern(q)} ESCAPE '\\'` : undefined)
  const order = status === 'published' || status === 'archived' || status === 'scheduled' ? desc(documents.publishedAt) : desc(documents.updatedAt)
  const [rows, [{ total }]] = await Promise.all([
    c.var.db.select().from(documents).where(where).orderBy(order, asc(documents.id)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    c.var.db.select({ total: countSql }).from(documents).where(where),
  ])
  return c.json({ posts: await summaries(c.var.db, rows), total, page, totalPages: Math.max(1, Math.ceil(total / PER_PAGE)) })
})

posts.get('/:id', async (c) => {
  const row = await loadPost(c.var.db, c.req.param('id'))
  if (!row || !canViewPost(row, userOf(c))) return c.json({ error: 'not_found' }, 404)
  return c.json({ post: await full(c.var.db, row) })
})

posts.get('/:id/audit', async (c) => {
  const row = await loadPost(c.var.db, c.req.param('id'))
  if (!row || !canViewPost(row, userOf(c))) return c.json({ error: 'not_found' }, 404)
  return c.json(await listAudit(c.var.db, { entityType: 'post', entityId: row.id }, 100))
})

/* --- saving ------------------------------------------------------------------------------------------ */

type SaveInput = ReturnType<typeof postSaveBody.parse>

async function checkContent(db: Db, body: SaveInput) {
  if (!body.title || isEmptyDoc(body.content)) return { error: 'missing_fields' as const }
  const categoryIds = await existingTermIds(db, 'category', body.categoryIds)
  if (categoryIds.length === 0) return { error: 'category_required' as const }
  const tagIds = await existingTermIds(db, 'tag', body.tagIds)
  return { categoryIds, tagIds }
}

const contentColumns = (body: SaveInput) => {
  const blocks = postBlocks(body.content)
  return {
    title: body.title,
    description: body.excerpt,
    blocks,
    featuredImage: body.featuredImage ?? null,
    imagePosition: body.imagePosition,
    searchText: searchTextOf(body.title, blocks),
    updatedAt: new Date(),
  }
}

/** A new post: always the author's own draft (or submitted at once). */
posts.post('/', validate('json', postSaveBody), async (c) => {
  const user = userOf(c)
  if (!can(user, 'news.write')) return c.json({ error: 'forbidden' }, 403)
  const body = c.req.valid('json')
  const checked = await checkContent(c.var.db, body)
  if ('error' in checked) return c.json({ error: checked.error }, 422)
  const submit = body.command === 'submit'
  const slug = uniqueSlug(body.title, await slugsOf(c.var.db, 'post', 'hu'))
  const [row] = await c.var.db
    .insert(documents)
    .values({ type: 'post', slug, locale: 'hu', status: submit ? 'in_review' : 'draft', authorId: user.id, updatedById: user.id, submittedAt: submit ? new Date() : null, ...contentColumns(body) })
    .returning()
  await setTerms(c.var.db, row.id, [...checked.categoryIds, ...checked.tagIds])
  await logAudit(c.var.db, { entityType: 'post', entityId: row.id, subject: row.title, action: 'created_draft', toStatus: 'draft', userId: user.id })
  if (submit) await logAudit(c.var.db, { entityType: 'post', entityId: row.id, subject: row.title, action: 'submitted', fromStatus: 'draft', toStatus: 'in_review', userId: user.id })
  return c.json({ post: await full(c.var.db, row), notice: submit ? 'submitted' : 'draft_saved' }, 201)
})

/**
 * Saves an existing post. Who may, depends on its status (canEditPost): the author their draft, a reviewer a
 * draft or a post in review, a manager a published post. `command: submit` sends a draft for review.
 */
posts.put('/:id', validate('json', postSaveBody), async (c) => {
  const user = userOf(c)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || !canEditPost(existing, user)) return c.json({ error: 'forbidden' }, 403)
  const body = c.req.valid('json')
  const checked = await checkContent(c.var.db, body)
  if ('error' in checked) return c.json({ error: checked.error }, 422)

  const submit = existing.status === 'draft' && body.command === 'submit'
  const status = submit ? 'in_review' : existing.status
  const [row] = await c.var.db
    .update(documents)
    .set({ ...contentColumns(body), status, updatedById: user.id, ...(submit ? { submittedAt: new Date(), reviewNote: null } : {}) })
    .where(eq(documents.id, existing.id))
    .returning()
  await setTerms(c.var.db, row.id, [...checked.categoryIds, ...checked.tagIds])

  const action = submit ? 'submitted' : existing.status === 'in_review' ? 'reviewer_edited' : existing.status === 'published' ? 'published_updated' : 'updated_draft'
  await logAudit(c.var.db, { entityType: 'post', entityId: row.id, subject: row.title, action, fromStatus: existing.status, toStatus: status, userId: user.id })
  const notice = submit ? 'submitted' : action === 'reviewer_edited' ? 'review_saved' : action === 'published_updated' ? 'published_updated' : 'draft_saved'
  return c.json({ post: await full(c.var.db, row), notice })
})

/* --- review ------------------------------------------------------------------------------------------- */

posts.post('/:id/decision', validate('json', reviewDecisionBody), async (c) => {
  const user = userOf(c)
  if (!can(user, 'news.review')) return c.json({ error: 'forbidden' }, 403)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || existing.status !== 'in_review') return c.json({ error: 'not_in_review' }, 400)
  const body = c.req.valid('json')
  const now = new Date()
  const db = c.var.db
  const audit = (action: string, toStatus: string, note?: string) =>
    logAudit(db, { entityType: 'post', entityId: existing.id, subject: existing.title, action, fromStatus: 'in_review', toStatus, note, userId: user.id })

  if (body.decision === 'reject') {
    if (!body.note) return c.json({ error: 'rejection_note_required' }, 422)
    await db.update(documents).set({ status: 'draft', reviewNote: body.note, reviewedById: user.id, reviewedAt: now, updatedAt: now }).where(eq(documents.id, existing.id))
    await audit('rejected', 'draft', body.note)
    return c.json({ notice: 'rejected' })
  }

  if (body.publishAt) {
    const at = new Date(body.publishAt)
    if (at.getTime() <= now.getTime() + 60_000) return c.json({ error: 'schedule_invalid' }, 422)
    await db
      .update(documents)
      .set({ status: 'scheduled', scheduledFor: at, scheduledById: user.id, publishedAt: at, reviewNote: null, reviewedById: user.id, reviewedAt: now, updatedAt: now })
      .where(eq(documents.id, existing.id))
    const display = at.toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })
    await audit('scheduled', 'scheduled', body.note ? `${body.note}\nPublikálás: ${display}` : `Publikálás: ${display}`)
    return c.json({ notice: 'scheduled' })
  }

  await db
    .update(documents)
    .set({ status: 'published', publishedAt: now, scheduledFor: null, scheduledById: null, reviewNote: null, reviewedById: user.id, reviewedAt: now, updatedAt: now })
    .where(eq(documents.id, existing.id))
  await audit('approved', 'published', body.note || undefined)
  return c.json({ notice: 'approved' })
})

/* --- archive, trash ---------------------------------------------------------------------------------------- */

posts.post('/:id/archive', async (c) => {
  const user = userOf(c)
  if (!can(user, 'news.manage')) return c.json({ error: 'forbidden' }, 403)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || existing.status !== 'published') return c.json({ error: 'not_found' }, 404)
  await c.var.db.update(documents).set({ status: 'archived', archivedAt: new Date(), archivedById: user.id, updatedAt: new Date() }).where(eq(documents.id, existing.id))
  await logAudit(c.var.db, { entityType: 'post', entityId: existing.id, subject: existing.title, action: 'published_archived', fromStatus: 'published', toStatus: 'archived', userId: user.id })
  return c.json({ notice: 'published_archived' })
})

posts.post('/:id/unarchive', async (c) => {
  const user = userOf(c)
  if (!can(user, 'news.manage')) return c.json({ error: 'forbidden' }, 403)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || existing.status !== 'archived') return c.json({ error: 'not_found' }, 404)
  await c.var.db.update(documents).set({ status: 'published', archivedAt: null, archivedById: null, updatedAt: new Date() }).where(eq(documents.id, existing.id))
  await logAudit(c.var.db, { entityType: 'post', entityId: existing.id, subject: existing.title, action: 'archived_restored', fromStatus: 'archived', toStatus: 'published', userId: user.id })
  return c.json({ notice: 'archived_restored' })
})

/** First DELETE: to the trash. DELETE of a trashed post: gone for good (the log keeps its title). */
posts.delete('/:id', async (c) => {
  const user = userOf(c)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || !canTrashPost(existing, user)) return c.json({ error: 'forbidden' }, 403)
  if (existing.status === 'trash') {
    await logAudit(c.var.db, { entityType: 'post', entityId: existing.id, subject: existing.title, action: 'deleted', fromStatus: 'trash', userId: user.id })
    await c.var.db.delete(documents).where(eq(documents.id, existing.id))
    return c.json({ notice: 'deleted', permanent: true })
  }
  await c.var.db.update(documents).set({ status: 'trash', updatedAt: new Date() }).where(eq(documents.id, existing.id))
  await logAudit(c.var.db, { entityType: 'post', entityId: existing.id, subject: existing.title, action: 'trashed', fromStatus: existing.status, toStatus: 'trash', userId: user.id })
  return c.json({ notice: 'trashed', permanent: false })
})

/** Restores from the trash as a draft, so nothing goes public by accident. */
posts.post('/:id/untrash', async (c) => {
  const user = userOf(c)
  const existing = await loadPost(c.var.db, c.req.param('id'))
  if (!existing || existing.status !== 'trash' || !canTrashPost(existing, user)) return c.json({ error: 'not_found' }, 404)
  await c.var.db.update(documents).set({ status: 'draft', scheduledFor: null, scheduledById: null, updatedAt: new Date() }).where(eq(documents.id, existing.id))
  await logAudit(c.var.db, { entityType: 'post', entityId: existing.id, subject: existing.title, action: 'untrashed', fromStatus: 'trash', toStatus: 'draft', userId: user.id })
  return c.json({ notice: 'untrashed' })
})

export default posts

/** Publishes the scheduled posts that are due. Runs every minute (index.ts); single instance assumed. */
export async function sweepScheduledPosts(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .update(documents)
    .set({ status: 'published', scheduledFor: null, updatedAt: now })
    .where(and(isPost, eq(documents.status, 'scheduled'), lte(documents.scheduledFor, now)))
    .returning({ id: documents.id, title: documents.title, publishedAt: documents.publishedAt })
  for (const post of due) {
    await logAudit(db, { entityType: 'post', entityId: post.id, subject: post.title, action: 'scheduled_published', fromStatus: 'scheduled', toStatus: 'published', note: 'Az időzített hír automatikusan megjelent.', userId: null })
  }
  return due.length
}

