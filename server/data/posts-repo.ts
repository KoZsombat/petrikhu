import type { Post, PostStatus } from '../../shared/pnw/types.ts'
import { row as one, rows as many, run } from './db.ts'
import { likePattern, searchTextOf } from './post-search.ts'

/** The DB row shape (snake_case columns) before it's turned back into a Post. */
type Row = {
  id: string
  slug: string
  title: string
  content: unknown
  excerpt: string
  category_ids: unknown
  tag_ids: unknown
  featured_image: string | null
  image_position: string
  origin: string
  author_id: string | null
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
    content: row.content as Post['content'],
    excerpt: row.excerpt,
    categoryIds: row.category_ids as string[],
    tagIds: row.tag_ids as string[],
    featuredImage: row.featured_image ?? undefined,
    imagePosition: row.image_position === 'bottom' ? 'bottom' : 'top',
    origin: row.origin === 'mirror' ? 'mirror' : 'hirkezelo',
    // Törölt fiók (ON DELETE SET NULL): üres azonosító, a felület "—"-t mutat.
    authorId: row.author_id ?? '',
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
    author_id: post.authorId || null,
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

/** Mire szűrhető egy hírlista; minden mező opcionális, a megadottak ÉS-kapcsolatban állnak. */
export type PostFilter = {
  status?: PostStatus | PostStatus[]
  /** Minden, ami NEM ez a státusz. */
  statusNot?: PostStatus
  authorId?: string
  origin?: 'mirror' | 'hirkezelo'
  /** Csak ennél nem későbbi `date` (az időzített söprés: ami már esedékes). */
  dateUntil?: string
  /** Egy nap (YYYY-MM-DD, UTC) hírei. */
  day?: string
  /** Részszó a címben vagy a szövegben (post-search.ts). */
  search?: string
}

export type PostOrder = 'date_desc' | 'date_asc' | 'modified_desc' | 'modified_asc'

const ORDER_SQL: Record<PostOrder, string> = {
  date_desc: 'date DESC, id',
  date_asc: 'date ASC, id',
  modified_desc: 'modified_at DESC, id',
  modified_asc: 'modified_at ASC, id',
}

function whereOf(filter: PostFilter): { sql: string; params: unknown[] } {
  const parts: string[] = []
  const params: unknown[] = []
  const add = (sql: string, value: unknown) => {
    params.push(value)
    parts.push(sql.replace('?', `$${params.length}`))
  }
  if (filter.status !== undefined) {
    if (Array.isArray(filter.status)) add('status = ANY(?)', filter.status)
    else add('status = ?', filter.status)
  }
  if (filter.statusNot !== undefined) add('status <> ?', filter.statusNot)
  if (filter.authorId !== undefined) add('author_id = ?', filter.authorId)
  if (filter.origin === 'mirror') add('origin = ?', 'mirror')
  if (filter.origin === 'hirkezelo') add('origin <> ?', 'mirror')
  if (filter.dateUntil !== undefined) add('date <= ?', filter.dateUntil)
  if (filter.day !== undefined) add("(date AT TIME ZONE 'UTC')::date = ?::date", filter.day)
  if (filter.search) add("search_text LIKE ? ESCAPE '\\'", likePattern(filter.search))
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params }
}

/** A szűrőnek megfelelő hírek, rendezve és lapozva - a szűrés, rendezés és lapozás az adatbázisban fut. */
export async function findPosts(
  filter: PostFilter,
  options: { order?: PostOrder; limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const { sql, params } = whereOf(filter)
  let text = `SELECT ${COLUMNS} FROM posts ${sql} ORDER BY ${ORDER_SQL[options.order ?? 'date_desc']}`
  if (options.limit !== undefined) {
    params.push(options.limit)
    text += ` LIMIT $${params.length}`
  }
  if (options.offset) {
    params.push(options.offset)
    text += ` OFFSET $${params.length}`
  }
  return (await many<Row>(text, params)).map(fromRow)
}

export async function countPosts(filter: PostFilter): Promise<number> {
  const { sql, params } = whereOf(filter)
  return (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM posts ${sql}`, params))!.n
}

/** Státuszonkénti darabszám (a hiányzó státusz 0-nak számít a hívónál). */
export async function countByStatus(filter: PostFilter = {}): Promise<Partial<Record<PostStatus, number>>> {
  const { sql, params } = whereOf(filter)
  const found = await many<{ status: PostStatus; n: number }>(`SELECT status, COUNT(*)::int AS n FROM posts ${sql} GROUP BY status`, params)
  return Object.fromEntries(found.map((r) => [r.status, r.n]))
}

export async function postSlugs(filter: PostFilter): Promise<string[]> {
  const { sql, params } = whereOf(filter)
  return (await many<{ slug: string }>(`SELECT slug FROM posts ${sql} ORDER BY slug`, params)).map((r) => r.slug)
}

/** Az import után (vagy bármikor): kitölti a hiányzó keresőszövegeket. */
export async function fillMissingSearchText(): Promise<number> {
  const missing = await many<Row>(`SELECT ${COLUMNS} FROM posts WHERE search_text IS NULL`)
  for (const r of missing) {
    const post = fromRow(r)
    await run('UPDATE posts SET search_text = $2 WHERE id = $1', [post.id, searchTextOf(post.title, post.content)])
  }
  return missing.length
}

export async function findPost(id: string): Promise<Post | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM posts WHERE id = $1`, [id])
  return found ? fromRow(found) : undefined
}

export async function findPostBySlug(slug: string): Promise<Post | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM posts WHERE slug = $1`, [slug])
  return found ? fromRow(found) : undefined
}

export async function existingSlugs(): Promise<Set<string>> {
  return new Set((await many<{ slug: string }>('SELECT slug FROM posts')).map((r) => r.slug))
}

export async function insertPost(post: Post): Promise<void> {
  await run(`INSERT INTO posts (${COLUMNS}, search_text) VALUES (${PLACEHOLDERS(ROW_KEYS.length + 1)})`, [
    ...valuesOf(toRow(post)),
    searchTextOf(post.title, post.content),
  ])
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
       archived_at = $15, archived_by_id = $16, modified_at = $17, date = $18, search_text = $19
     WHERE id = $1`,
    [
      r.id, r.title, r.content, r.excerpt, r.category_ids, r.tag_ids, r.featured_image, r.image_position, r.status,
      r.review_note, r.last_reviewer_id, r.last_reviewed_at, r.scheduled_for, r.scheduled_by_id, r.archived_at,
      r.archived_by_id, r.modified_at, r.date, searchTextOf(next.title, next.content),
    ],
  )
  return next
}

export async function removePost(id: string): Promise<void> {
  await run('DELETE FROM posts WHERE id = $1', [id])
}
