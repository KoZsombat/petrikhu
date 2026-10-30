import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { CAPABILITY, STATUS } from '../../shared/pnw/types.ts'
import type { Post, PostStatus } from '../../shared/pnw/types.ts'
import { canEditWorkflowPost, canViewWorkflowPost } from '../../shared/pnw/access.ts'
import { canReview, hasCapability } from '../../shared/pnw/permissions.ts'
import { allPosts, existingSlugs, findPost, insertPost, removePost, updatePost } from '../data/posts-repo.ts'
import { termIdsOfKind } from '../data/terms-repo.ts'
import { uniqueSlug } from '../../shared/pnw/slug.ts'
import { requireCapability, requireLogin } from '../middleware/auth.ts'
import { logAudit, recentAudit } from '../lib/audit.ts'
import { notifyApproved, notifyRejected, notifyScheduled, notifySubmitted } from '../lib/notifications.ts'
import { hasRealText, parseIdList, parseRichText, sanitizeTermIds } from '../lib/validation.ts'
import { blockText } from '../../shared/pnw/richtext.ts'
import { TEST_MODE } from '../config.ts'
import { storeImage, upload } from '../lib/uploads.ts'

const router = Router()

function now(): string {
  return new Date().toISOString()
}

/** The multer config and the image check are shared with the Szerkesztő's media picker (lib/uploads.ts). */
const handleFeaturedImage = storeImage

router.use(requireLogin)

/**
 * Mirrors render_dashboard()'s two branches - which branch you get is now a
 * question about one capability, not about a role (AGENT.md 6.16).
 */
router.get('/dashboard', async (req, res) => {
  const user = req.pnwUser!
  const all = await allPosts()
  const mine = all.filter((post) => post.authorId === user.id)

  if (!canReview(user)) {
    res.json({
      view: 'author',
      counts: {
        [STATUS.DRAFT]: mine.filter((p) => p.status === STATUS.DRAFT).length,
        [STATUS.PENDING]: mine.filter((p) => p.status === STATUS.PENDING).length,
        [STATUS.REVISION]: mine.filter((p) => p.status === STATUS.REVISION).length,
        [STATUS.FUTURE]: mine.filter((p) => p.status === STATUS.FUTURE).length,
        [STATUS.PUBLISH]: mine.filter((p) => p.status === STATUS.PUBLISH).length,
      },
      posts: sortByModified(mine),
    })
    return
  }

  const pending = all
    .filter((p) => p.status === STATUS.PENDING)
    .sort((a, b) => a.modifiedAt.localeCompare(b.modifiedAt))
  const ownWorking = sortByModified(
    mine.filter((p) => p.status === STATUS.DRAFT || p.status === STATUS.REVISION),
  )
  const scheduled = all
    .filter((p) => p.status === STATUS.FUTURE)
    .sort((a, b) => a.date.localeCompare(b.date))
  const recent = sortByModified(
    all.filter((p) =>
      ([STATUS.PUBLISH, STATUS.FUTURE, STATUS.REVISION, STATUS.TEST_APPROVED] as PostStatus[]).includes(p.status),
    ),
  ).slice(0, 10)
  const todayKey = new Date().toISOString().slice(0, 10)
  const publishedToday = all.filter(
    (p) => p.status === STATUS.PUBLISH && (p.date ?? '').startsWith(todayKey),
  ).length

  res.json({
    view: 'reviewer',
    pendingCount: pending.length,
    returnedCount: all.filter((p) => p.status === STATUS.REVISION).length,
    scheduledCount: scheduled.length,
    publishedTodayCount: publishedToday,
    ownWorking,
    pending,
    scheduled: scheduled.slice(0, 10),
    recent,
  })
})

/** Mirrors render_published_news(). */
router.get('/published', requireCapability(CAPABILITY.MANAGE_PUBLISHED), async (req, res) => {
  const { list, total, totalPages } = paginate((await allPosts()).filter((p) => p.status === STATUS.PUBLISH), req)
  res.json({ posts: list, total, totalPages, testMode: TEST_MODE })
})

/** Mirrors render_archived_news(). */
router.get('/archived', requireCapability(CAPABILITY.MANAGE_PUBLISHED), async (req, res) => {
  const { list, total, totalPages } = paginate((await allPosts()).filter((p) => p.status === STATUS.ARCHIVED), req)
  res.json({ posts: list, total, totalPages })
})

router.get('/:id', async (req, res) => {
  const post = await findPost(String(req.params.id))
  if (!post || !canViewPost(post, req.pnwUser!)) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ post })
})

/** Mirrors PNW_Actions::save_news() for a brand-new draft. */
/** Kép a hír szövegébe (egy kép vagy egy galéria elemei): mindenki tölthet fel, aki hírt írhat vagy kezelhet. */
router.post('/media', upload.single('file'), async (req, res) => {
  const user = req.pnwUser
  const allowed = [CAPABILITY.SUBMIT_NEWS, CAPABILITY.REVIEW_NEWS, CAPABILITY.MANAGE_PUBLISHED].some((c) => user && hasCapability(user, c))
  if (!allowed) {
    res.status(user ? 403 : 401).json({ error: user ? 'forbidden' : 'not_logged_in' })
    return
  }
  const url = await storeImage(req.file)
  if (!url) {
    res.status(422).json({ error: 'not_an_image' })
    return
  }
  res.json({ url })
})

router.post('/', requireCapability(CAPABILITY.SUBMIT_NEWS), upload.single('featuredImage'), async (req, res) => {
  const result = await saveAuthoredPost(req, null)
  respondToSave(res, result)
})

/** Mirrors save_news() for an existing draft/revision. */
router.put('/:id', requireCapability(CAPABILITY.SUBMIT_NEWS), upload.single('featuredImage'), async (req, res) => {
  const existing = await findPost(String(req.params.id))
  if (!existing || !canEditWorkflowPost(existing, req.pnwUser!)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  const result = await saveAuthoredPost(req, existing)
  respondToSave(res, result)
})

/** Mirrors reviewer_save() - a reviewer editing a still-pending post. */
router.put('/:id/reviewer', requireCapability(CAPABILITY.REVIEW_NEWS), async (req, res) => {
  const existing = await findPost(String(req.params.id))
  if (!existing || existing.status !== STATUS.PENDING) {
    res.status(400).json({ error: 'not_pending' })
    return
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const content = parseRichText(JSON.stringify(req.body?.content ?? []))
  const excerpt = typeof req.body?.excerpt === 'string' ? req.body.excerpt : ''
  const categoryIds = sanitizeTermIds(req.body?.categoryIds, await termIdsOfKind('category'))
  const tagIds = sanitizeTermIds(req.body?.tagIds, await termIdsOfKind('tag'))
  const imagePosition = req.body?.imagePosition === 'bottom' ? 'bottom' : 'top'

  if (!title || !content || !hasRealText(content) || categoryIds.length === 0) {
    res.status(422).json({ error: 'missing_fields' })
    return
  }

  await updatePost(existing.id, (post) => ({
    ...post,
    title,
    content,
    excerpt,
    categoryIds,
    tagIds,
    imagePosition,
    modifiedAt: now(),
  }))

  await logAudit(existing.id, 'reviewer_edited', STATUS.PENDING, STATUS.PENDING, undefined, req.pnwUser!.id)
  res.json({ notice: 'review_saved' })
})

/** Mirrors review_news() - approve/reject/schedule a pending post. */
router.post('/:id/decision', requireCapability(CAPABILITY.REVIEW_NEWS), async (req, res) => {
  const existing = await findPost(String(req.params.id))
  if (!existing || existing.status !== STATUS.PENDING) {
    res.status(400).json({ error: 'not_pending' })
    return
  }

  const decision = req.body?.decision
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : ''

  if (decision === 'reject') {
    if (!note) {
      res.status(422).json({ error: 'rejection_note_required' })
      return
    }

    await updatePost(existing.id, (post) => ({
      ...post,
      status: STATUS.REVISION,
      reviewNote: note,
      lastReviewerId: req.pnwUser!.id,
      lastReviewedAt: now(),
      modifiedAt: now(),
    }))

    await logAudit(existing.id, 'rejected', STATUS.PENDING, STATUS.REVISION, note, req.pnwUser!.id)
    notifyRejected(existing, note)
    res.json({ notice: 'rejected' })
    return
  }

  if (decision !== 'approve') {
    res.status(400).json({ error: 'unknown_decision' })
    return
  }

  const publishMode = req.body?.publishMode === 'schedule' && !TEST_MODE ? 'schedule' : 'now'

  if (publishMode === 'schedule') {
    const publishAt = new Date(String(req.body?.publishAt ?? ''))
    if (Number.isNaN(publishAt.getTime()) || publishAt.getTime() <= Date.now() + 60_000) {
      res.status(422).json({ error: 'schedule_invalid' })
      return
    }

    await updatePost(existing.id, (post) => ({
      ...post,
      status: STATUS.FUTURE,
      date: publishAt.toISOString(),
      scheduledFor: publishAt.toISOString(),
      scheduledById: req.pnwUser!.id,
      reviewNote: undefined,
      lastReviewerId: req.pnwUser!.id,
      lastReviewedAt: now(),
      modifiedAt: now(),
    }))

    const display = publishAt.toLocaleString('hu-HU')
    await logAudit(
      existing.id,
      'scheduled',
      STATUS.PENDING,
      STATUS.FUTURE,
      note ? `${note}\nPublikálás: ${display}` : `Publikálás: ${display}`,
      req.pnwUser!.id,
    )
    notifyScheduled(existing, display)
    res.json({ notice: 'scheduled' })
    return
  }

  // TEST_MODE (server/config.ts) never reaches real 'publish' - matches the plugin's own guard.
  const targetStatus = TEST_MODE ? STATUS.TEST_APPROVED : STATUS.PUBLISH

  await updatePost(existing.id, (post) => ({
    ...post,
    status: targetStatus,
    date: now(),
    reviewNote: undefined,
    lastReviewerId: req.pnwUser!.id,
    lastReviewedAt: now(),
    modifiedAt: now(),
    scheduledFor: undefined,
    scheduledById: undefined,
  }))

  await logAudit(existing.id, 'approved', STATUS.PENDING, targetStatus, note || undefined, req.pnwUser!.id)
  notifyApproved(existing)
  res.json({ notice: 'approved' })
})

/** Mirrors delete_news() - trash your own draft/revision. */
router.delete('/:id', requireCapability(CAPABILITY.SUBMIT_NEWS), async (req, res) => {
  const existing = await findPost(String(req.params.id))
  if (!existing || !canEditWorkflowPost(existing, req.pnwUser!)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  await logAudit(existing.id, 'trashed', existing.status, STATUS.TRASH, undefined, req.pnwUser!.id)
  await removePost(existing.id)
  res.json({ notice: 'trashed' })
})

/** Mirrors update_published_news(). */
router.put(
  '/:id/published',
  requireCapability(CAPABILITY.MANAGE_PUBLISHED),
  upload.single('featuredImage'),
  async (req, res) => {
    if (TEST_MODE) {
      res.status(403).json({ error: 'production_only' })
      return
    }
    const existing = await findPost(String(req.params.id))
    if (!existing || existing.status !== STATUS.PUBLISH) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const result = await saveAuthoredPost(req, existing, { keepStatus: true })
    respondToSave(res, result, 'published_updated')
  },
)

/** Mirrors PNW_Actions' archive_published_news equivalent. */
router.post('/:id/archive', requireCapability(CAPABILITY.MANAGE_PUBLISHED), async (req, res) => {
  if (TEST_MODE) {
    res.status(403).json({ error: 'production_only' })
    return
  }
  const existing = await findPost(String(req.params.id))
  if (!existing || existing.status !== STATUS.PUBLISH) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  await updatePost(existing.id, (post) => ({
    ...post,
    status: STATUS.ARCHIVED,
    archivedAt: now(),
    archivedById: req.pnwUser!.id,
    modifiedAt: now(),
  }))

  await logAudit(existing.id, 'published_archived', STATUS.PUBLISH, STATUS.ARCHIVED, undefined, req.pnwUser!.id)
  res.json({ notice: 'published_archived' })
})

router.post('/:id/restore', requireCapability(CAPABILITY.MANAGE_PUBLISHED), async (req, res) => {
  const existing = await findPost(String(req.params.id))
  if (!existing || existing.status !== STATUS.ARCHIVED) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  await updatePost(existing.id, (post) => ({
    ...post,
    status: STATUS.PUBLISH,
    archivedAt: undefined,
    archivedById: undefined,
    modifiedAt: now(),
  }))

  await logAudit(existing.id, 'archived_restored', STATUS.ARCHIVED, STATUS.PUBLISH, undefined, req.pnwUser!.id)
  res.json({ notice: 'archived_restored' })
})

router.get('/:id/audit', async (req, res) => {
  const post = await findPost(String(req.params.id))
  if (!post || !canViewPost(post, req.pnwUser!)) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ entries: await recentAudit(30, post.id) })
})

// --- helpers ---------------------------------------------------------------

function canViewPost(post: Post, user: import('../../shared/pnw/types.ts').SessionUser): boolean {
  if (post.status === STATUS.PUBLISH || post.status === STATUS.ARCHIVED) return true
  return canViewWorkflowPost(post, user)
}

function sortByModified(list: Post[]): Post[] {
  return [...list].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
}

function paginate(list: Post[], req: import('express').Request) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
  const page = Math.max(1, Number(req.query.page) || 1)
  const perPage = 30

  const filtered = q
    ? list.filter(
        (post) =>
          post.title.toLowerCase().includes(q) ||
          post.content.some((block) => blockText(block).toLowerCase().includes(q)),
      )
    : list

  const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date))
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const list_ = sorted.slice((page - 1) * perPage, page * perPage)
  return { list: list_, total: sorted.length, totalPages }
}

type SaveResult =
  | { ok: true; post: Post; notice: 'draft_saved' | 'submitted' }
  | { ok: false; notice: 'missing_fields' | 'category_required' }

async function saveAuthoredPost(
  req: import('express').Request,
  existing: Post | null,
  options: { keepStatus?: boolean } = {},
): Promise<SaveResult> {
  const user = req.pnwUser!
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const content = parseRichText(req.body?.content)
  const excerpt = typeof req.body?.excerpt === 'string' ? req.body.excerpt : ''
  const command = req.body?.command === 'submit' ? 'submit' : 'draft'

  if (!title || !content || !hasRealText(content)) {
    return { ok: false, notice: 'missing_fields' }
  }

  // No allow-list any more: every account may use every category and tag
  // (AGENT.md 6.16), so the only check is that the ids really exist - read
  // fresh, since a term created moments ago in the same editor must count.
  const categoryIds = sanitizeTermIds(parseIdList(req.body?.categoryIds), await termIdsOfKind('category'))
  const tagIds = sanitizeTermIds(parseIdList(req.body?.tagIds), await termIdsOfKind('tag'))
  if (categoryIds.length === 0) {
    return { ok: false, notice: 'category_required' }
  }

  const featuredImage = await handleFeaturedImage(req.file)
  const imagePosition = req.body?.imagePosition === 'bottom' ? 'bottom' : 'top'
  const oldStatus = existing?.status ?? ''
  const newStatus = options.keepStatus ? existing!.status : command === 'submit' ? STATUS.PENDING : STATUS.DRAFT

  let saved: Post
  if (existing) {
    saved = await updatePost(existing.id, (post) => ({
      ...post,
      title,
      content,
      excerpt,
      categoryIds,
      tagIds,
      imagePosition,
      status: newStatus,
      modifiedAt: now(),
      featuredImage: featuredImage ?? post.featuredImage,
      reviewNote: command === 'submit' ? undefined : post.reviewNote,
    }))
  } else {
    const post: Post = {
      id: randomUUID(),
      // Stable from creation, even if the title is edited later - see shared/pnw/slug.ts.
      slug: uniqueSlug(title, await existingSlugs()),
      title,
      content,
      excerpt,
      categoryIds,
      tagIds,
      featuredImage,
      imagePosition,
      authorId: user.id,
      status: newStatus,
      createdAt: now(),
      modifiedAt: now(),
      date: now(),
    }
    await insertPost(post)
    saved = post
  }

  if (command === 'submit') {
    await logAudit(saved.id, 'submitted', oldStatus, STATUS.PENDING, undefined, user.id)
    notifySubmitted(saved)
    return { ok: true, post: saved, notice: 'submitted' }
  }

  await logAudit(saved.id, existing ? 'updated_draft' : 'created_draft', oldStatus, STATUS.DRAFT, undefined, user.id)
  return { ok: true, post: saved, notice: 'draft_saved' }
}

function respondToSave(res: import('express').Response, result: SaveResult, overrideNotice?: string): void {
  if (!result.ok) {
    res.status(422).json({ error: result.notice })
    return
  }
  res.json({ post: result.post, notice: overrideNotice ?? result.notice })
}

export default router
