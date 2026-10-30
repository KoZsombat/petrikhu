/**
 * A Creator-ben mentett oldalak. Ugyanaz a forma, mint a posts-repo.ts:
 * fromRow/toRow, JSON szöveges oszlop, aszinkron (pg) hívások.
 */
import type { CreatorPageStatus, CreatorPageSummary, PageBlock, StoredCreatorPage } from '../../shared/pnw/creator-types.ts'
import { row as one, rows as many, run } from './db.ts'

type Row = {
  id: string
  slug: string
  title: string
  description: string
  blocks: unknown
  status: string
  deleted: boolean
  author_id: string | null
  created_at: string
  modified_at: string
  modified_by_id: string | null
}

function fromRow(row: Row): StoredCreatorPage {
  const page: StoredCreatorPage = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    blocks: row.blocks as PageBlock[],
    status: row.status as CreatorPageStatus,
    deleted: row.deleted,
    authorId: row.author_id ?? '',
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  }
  if (row.modified_by_id) page.modifiedById = row.modified_by_id
  return page
}

const COLUMNS = 'id, slug, title, description, blocks, status, deleted, author_id, created_at, modified_at, modified_by_id'

export async function listPages(): Promise<StoredCreatorPage[]> {
  return (await many<Row>(`SELECT ${COLUMNS} FROM creator_pages ORDER BY modified_at DESC`)).map(fromRow)
}

/** A lista nézet blokkok nélkül kapja az oldalakat: azok több száz KB-osak is lehetnek. */
export async function listSummaries(): Promise<CreatorPageSummary[]> {
  return (await listPages()).map(({ blocks, ...summary }) => {
    void blocks
    return summary
  })
}

export async function getPage(id: string): Promise<StoredCreatorPage | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM creator_pages WHERE id = $1`, [id])
  return found ? fromRow(found) : undefined
}

export async function getPageBySlug(slug: string): Promise<StoredCreatorPage | undefined> {
  const found = await one<Row>(`SELECT ${COLUMNS} FROM creator_pages WHERE slug = $1`, [slug])
  return found ? fromRow(found) : undefined
}

export async function existingPageSlugs(): Promise<Set<string>> {
  return new Set((await many<{ slug: string }>('SELECT slug FROM creator_pages')).map((r) => r.slug))
}

/** Új oldalt szúr be, vagy módosítja az adott id-jút. A slug sosem változik: ez az oldal nyilvános címe. */
export async function savePage(page: StoredCreatorPage): Promise<StoredCreatorPage> {
  await run(
    `INSERT INTO creator_pages (${COLUMNS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, description = excluded.description, blocks = excluded.blocks,
       status = excluded.status, deleted = excluded.deleted,
       modified_at = excluded.modified_at, modified_by_id = excluded.modified_by_id`,
    [
      page.id, page.slug, page.title, page.description, JSON.stringify(page.blocks), page.status,
      page.deleted, page.authorId || null, page.createdAt, page.modifiedAt, page.modifiedById ?? null,
    ],
  )
  return page
}

export async function deletePage(id: string): Promise<void> {
  await run('DELETE FROM creator_pages WHERE id = $1', [id])
}
