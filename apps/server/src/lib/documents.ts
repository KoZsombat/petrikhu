/**
 * Pages and posts (one `documents` table). Rows become DTOs here, and only here: `toPost` / `toPage` are the
 * admin shapes, `toPublic*` list every public field explicitly, so internal columns (review note, author and
 * reviewer ids, search text...) can never leak into a public response by accident.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Block } from '@petrik/shared/blocks'
import type { Locale, Page, PageSummary, Post, PostSummary, PublicPage, PublicPost, PublicPostSummary } from '@petrik/shared/schemas'
import { fold } from '@petrik/shared/slug'
import { emptyDoc, firstImage, plainText } from '@petrik/shared/tiptap'
import type { RichDoc } from '@petrik/shared/tiptap'
import type { PageStatus, PostStatus } from '@petrik/shared/workflow'
import type { Db } from '../db/client.ts'
import { documents, documentTerms, terms } from '../db/schema.ts'

export type DocumentRow = typeof documents.$inferSelect

const iso = (date: Date | null) => (date ? date.toISOString() : null)

/** A post's body is the content of its single richText block. */
export function postContent(blocks: Block[]): RichDoc {
  const block = blocks.find((b) => b.type === 'richText')
  return block?.type === 'richText' ? block.props.content : emptyDoc()
}

export function postBlocks(content: RichDoc): Block[] {
  return [{ id: 'body', type: 'richText', props: { content } }]
}

/** Lowercased, accent-free title + text: what `?q=` searches. */
export function searchTextOf(title: string, blocks: Block[]): string {
  const text: string[] = [title]
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>
      if (node.type === 'doc') text.push(plainText(node as RichDoc))
      else Object.values(node).forEach(visit)
    } else if (typeof value === 'string' && value.length < 2000 && !value.startsWith('/') && !/^https?:/.test(value)) text.push(value)
  }
  blocks.forEach((block) => visit(block.props))
  return fold(text.join('\n'))
}

export function likePattern(query: string): string {
  return `%${fold(query).replace(/[\\%_]/g, '\\$&')}%`
}

/* --- terms of posts ------------------------------------------------------------------------------- */

export async function termIdsOf(db: Db, ids: string[]): Promise<Map<string, { categoryIds: string[]; tagIds: string[] }>> {
  const out = new Map(ids.map((id) => [id, { categoryIds: [] as string[], tagIds: [] as string[] }]))
  if (ids.length === 0) return out
  const rows = await db
    .select({ documentId: documentTerms.documentId, termId: documentTerms.termId, kind: terms.kind })
    .from(documentTerms)
    .innerJoin(terms, eq(terms.id, documentTerms.termId))
    .where(inArray(documentTerms.documentId, ids))
    .orderBy(asc(documentTerms.position))
  for (const row of rows) {
    const entry = out.get(row.documentId)!
    ;(row.kind === 'category' ? entry.categoryIds : entry.tagIds).push(row.termId)
  }
  return out
}

export async function setTerms(db: Db, documentId: string, termIds: string[]): Promise<void> {
  await db.delete(documentTerms).where(eq(documentTerms.documentId, documentId))
  const unique = [...new Set(termIds)]
  if (unique.length) await db.insert(documentTerms).values(unique.map((termId, position) => ({ documentId, termId, position })))
}

/** Only ids of existing terms of that kind survive. */
export async function existingTermIds(db: Db, kind: 'category' | 'tag', ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const found = new Set((await db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, kind), inArray(terms.id, ids)))).map((r) => r.id))
  return [...new Set(ids)].filter((id) => found.has(id))
}

/** Category names per document (public lists), in the post's own order. */
export async function categoryNamesOf(db: Db, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]))
  if (ids.length === 0) return out
  const rows = await db
    .select({ documentId: documentTerms.documentId, name: terms.name })
    .from(documentTerms)
    .innerJoin(terms, eq(terms.id, documentTerms.termId))
    .where(and(inArray(documentTerms.documentId, ids), eq(terms.kind, 'category')))
    .orderBy(asc(documentTerms.position))
  for (const row of rows) out.get(row.documentId)!.push(row.name)
  return out
}

/** The ids of a category (matched by accent-insensitive name) and all its descendants. */
export async function categoryWithChildren(db: Db, name: string): Promise<string[] | null> {
  const all = await db.select({ id: terms.id, name: terms.name, parentId: terms.parentId }).from(terms).where(eq(terms.kind, 'category'))
  const root = all.find((term) => fold(term.name) === fold(name))
  if (!root) return null
  const ids = new Set([root.id])
  for (let grew = true; grew; ) {
    grew = false
    for (const term of all) {
      if (term.parentId && ids.has(term.parentId) && !ids.has(term.id)) {
        ids.add(term.id)
        grew = true
      }
    }
  }
  return [...ids]
}

/* --- DTOs ---------------------------------------------------------------------------------------------- */

export function toPostSummary(row: DocumentRow, termIds = { categoryIds: [] as string[], tagIds: [] as string[] }): PostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.description,
    categoryIds: termIds.categoryIds,
    tagIds: termIds.tagIds,
    featuredImage: row.featuredImage,
    imagePosition: row.imagePosition,
    status: row.status as PostStatus,
    authorId: row.authorId,
    reviewNote: row.reviewNote,
    reviewedById: row.reviewedById,
    reviewedAt: iso(row.reviewedAt),
    scheduledFor: iso(row.scheduledFor),
    publishedAt: iso(row.publishedAt),
    archivedAt: iso(row.archivedAt),
    trashedFrom: (row.trashedFrom as PostStatus | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    legacy: row.legacy,
  }
}

export function toPost(row: DocumentRow, termIds?: { categoryIds: string[]; tagIds: string[] }): Post {
  return { ...toPostSummary(row, termIds), content: postContent(row.blocks) }
}

export function toPageSummary(row: DocumentRow): PageSummary {
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale as Locale,
    title: row.title,
    description: row.description,
    status: row.status as PageStatus,
    translationOf: row.translationOf,
    authorId: row.authorId,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toPage(row: DocumentRow): Page {
  return { ...toPageSummary(row), blocks: row.blocks }
}

export function toPublicPostSummary(row: DocumentRow, categories: string[]): PublicPostSummary {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.description || excerptOf(postContent(row.blocks)),
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    categories,
    image: row.featuredImage ?? firstImage(postContent(row.blocks)) ?? null,
  }
}

export function toPublicPost(row: DocumentRow, categories: string[]): PublicPost {
  return { ...toPublicPostSummary(row, categories), content: postContent(row.blocks), featuredImage: row.featuredImage, imagePosition: row.imagePosition }
}

export function toPublicPage(row: DocumentRow, alternate: PublicPage['alternate']): PublicPage {
  return { slug: row.slug, locale: row.locale as Locale, title: row.title, description: row.description, blocks: row.blocks, alternate }
}

/** The first ~200 characters of the text. */
export function excerptOf(doc: RichDoc, max = 220): string {
  const text = plainText(doc).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/* --- queries ------------------------------------------------------------------------------------------------- */

export async function findDocument(db: Db, id: string): Promise<DocumentRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  return (await db.select().from(documents).where(eq(documents.id, id)).limit(1))[0]
}

export async function findBySlug(db: Db, type: 'page' | 'post', locale: Locale, slug: string): Promise<DocumentRow | undefined> {
  return (await db.select().from(documents).where(and(eq(documents.type, type), eq(documents.locale, locale), eq(documents.slug, slug))).limit(1))[0]
}

export async function slugsOf(db: Db, type: 'page' | 'post', locale: Locale): Promise<Set<string>> {
  return new Set((await db.select({ slug: documents.slug }).from(documents).where(and(eq(documents.type, type), eq(documents.locale, locale)))).map((r) => r.slug))
}

export const countSql = sql<number>`count(*)::int`
