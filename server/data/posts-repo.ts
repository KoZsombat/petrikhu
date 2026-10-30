import type { Post } from '../../shared/pnw/types.ts'
import { row as one, rows as many, run } from './db.ts'

/** The DB row shape (snake_case columns) before it's turned back into a Post. */
type Row = {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string
  category_ids: string
  tag_ids: string
  featured_image: string | null
  image_position: string
  origin: string
  author_id: string
  status: string
  review_note: string | null
  last_reviewer_id: string | null
  last_reviewed_at: string | null
  scheduled_for: string | null
  scheduled_by_id: string | null
  archived_at: string | null
  archived_by_id: string | null
  created_at: string
  modified_at: string
  date: string
}

function fromRow(row: Row): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: JSON.parse(row.content),
    excerpt: row.excerpt,
    categoryIds: JSON.parse(row.category_ids),
    tagIds: JSON.parse(row.tag_ids),
    featuredImage: row.featured_image ?? undefined,
    imagePosition: row.image_position === 'bottom' ? 'bottom' : 'top',
    origin: row.origin === 'mirror' ? 'mirror' : 'hirkezelo',
    authorId: row.author_id,
    status: row.status as Post['status'],
    reviewNote: row.review_note ?? undefined,
    lastReviewerId: row.last_reviewer_id ?? undefined,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    scheduledFor: row.scheduled_for ?? undefined,
    scheduledById: row.scheduled_by_id ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedById: row.archived_by_id ?? undefined,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    date: row.date,
  }
}

function toRow(post: Post): Row {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    content: JSON.stringify(post.content),
    excerpt: post.excerpt,
    category_ids: JSON.stringify(post.categoryIds),
    tag_ids: JSON.stringify(post.tagIds),
    featured_image: post.featuredImage ?? null,
    image_position: post.imagePosition === 'bottom' ? 'bottom' : 'top',
    origin: post.origin ?? 'hirkezelo',
    author_id: post.authorId,
    status: post.status,
    review_note: post.reviewNote ?? null,
    last_reviewer_id: post.lastReviewerId ?? null,
    last_reviewed_at: post.lastReviewedAt ?? null,
    scheduled_for: post.scheduledFor ?? null,
    scheduled_by_id: post.scheduledById ?? null,
    archived_at: post.archivedAt ?? null,
    archived_by_id: post.archivedById ?? null,
    created_at: post.createdAt,
    modified_at: post.modifiedAt,
    date: post.date,
  }
}

const COLUMNS =
  'id, slug, title, content, excerpt, category_ids, tag_ids, featured_image, image_position, origin, author_id, status, review_note, last_reviewer_id, last_reviewed_at, scheduled_for, scheduled_by_id, archived_at, archived_by_id, created_at, modified_at, date'

const PLACEHOLDERS = (count: number) => Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ')
const ROW_KEYS = COLUMNS.split(', ') as (keyof Row)[]
const valuesOf = (row: Row) => ROW_KEYS.map((key) => row[key])

export async function allPosts(): Promise<Post[]> {
  return (await many<Row>(`SELECT ${COLUMNS} FROM posts`)).map(fromRow)
}

export async function findPost(id: string): Promise<Post | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM posts WHERE id = $1`, [id])
  return found ? fromRow(found) : undefined
}

export async function findPostBySlug(slug: string): Promise<Post | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM posts WHERE slug = $1`, [slug])
  return found ? fromRow(found) : undefined
}

export async function postsByStatus(status: string): Promise<Post[]> {
  return (await many<Row>(`SELECT ${COLUMNS} FROM posts WHERE status = $1 ORDER BY date DESC`, [status])).map(fromRow)
}

export async function existingSlugs(): Promise<Set<string>> {
  return new Set((await many<{ slug: string }>('SELECT slug FROM posts')).map((r) => r.slug))
}

export async function insertPost(post: Post): Promise<void> {
  await run(`INSERT INTO posts (${COLUMNS}) VALUES (${PLACEHOLDERS(ROW_KEYS.length)})`, valuesOf(toRow(post)))
}

export async function updatePost(id: string, updater: (post: Post) => Post): Promise<Post> {
  const existing = await findPost(id)
  if (!existing) throw new Error(`no such post: ${id}`)
  const next = updater(existing)
  const r = toRow(next)
  await run(
    `UPDATE posts SET
       title = $2, content = $3, excerpt = $4, category_ids = $5, tag_ids = $6,
       featured_image = $7, image_position = $8, status = $9, review_note = $10,
       last_reviewer_id = $11, last_reviewed_at = $12,
       scheduled_for = $13, scheduled_by_id = $14,
       archived_at = $15, archived_by_id = $16, modified_at = $17, date = $18
     WHERE id = $1`,
    [
      r.id, r.title, r.content, r.excerpt, r.category_ids, r.tag_ids, r.featured_image, r.image_position, r.status,
      r.review_note, r.last_reviewer_id, r.last_reviewed_at, r.scheduled_for, r.scheduled_by_id, r.archived_at,
      r.archived_by_id, r.modified_at, r.date,
    ],
  )
  return next
}

export async function removePost(id: string): Promise<void> {
  await run('DELETE FROM posts WHERE id = $1', [id])
}
