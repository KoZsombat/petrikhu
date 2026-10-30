/**
 * Categories and tags, in PostgreSQL (see AGENT.md 6.16). The earlier
 * shared/pnw/categories.ts was a fixed, build-time list derived from the
 * mirror's category archives; it survives only as the seed
 * (shared/pnw/seed-terms.ts) for a fresh database. From there on terms are
 * ordinary rows: everyone may *use* any of them, and anyone holding
 * `pnw_manage_terms` may add more.
 */
import { randomUUID } from 'node:crypto'
import type { Term, TermKind } from '../../shared/pnw/types.ts'
import { SEED_CATEGORIES } from '../../shared/pnw/seed-terms.ts'
import { row as one, rows as many, run, transaction } from './db.ts'

type Row = {
  id: string
  kind: string
  name: string
  route: string | null
}

function fromRow(row: Row): Term {
  return {
    id: row.id,
    kind: row.kind as TermKind,
    name: row.name,
    route: row.route ?? undefined,
  }
}

export async function allTerms(): Promise<Term[]> {
  return (await many<Row>('SELECT id, kind, name, route FROM terms ORDER BY lower(name)')).map(fromRow)
}

export async function termsOfKind(kind: TermKind): Promise<Term[]> {
  return (await many<Row>('SELECT id, kind, name, route FROM terms WHERE kind = $1 ORDER BY lower(name)', [kind])).map(fromRow)
}

export async function findTermByName(kind: TermKind, name: string): Promise<Term | undefined> {
  const found = await one<Row>('SELECT id, kind, name, route FROM terms WHERE kind = $1 AND lower(name) = lower($2)', [
    kind,
    name.trim(),
  ])
  return found ? fromRow(found) : undefined
}

/** Ids of every term of one kind - what a post's category/tag list is validated against. */
export async function termIdsOfKind(kind: TermKind): Promise<Set<string>> {
  return new Set((await termsOfKind(kind)).map((term) => term.id))
}

const INSERT = `
  INSERT INTO terms (id, kind, name, route, created_at, created_by_id)
  VALUES ($1, $2, $3, $4, $5, $6)
`

export async function createTerm(kind: TermKind, name: string, createdById: string): Promise<Term> {
  const term: Term = { id: randomUUID(), kind, name: name.trim() }
  // Only the seeded categories map onto a mirrored archive page; one
  // created here has no archive route, and must not pretend to have one.
  await run(INSERT, [term.id, term.kind, term.name, null, new Date().toISOString(), createdById])
  return term
}

/**
 * The mirror's own WordPress categories, seeded once into an empty table -
 * so the editor's category list starts out exactly as it was before terms
 * became editable. After that these are ordinary rows like any other.
 */
export async function seedInitialTerms(): Promise<void> {
  const { n } = (await one<{ n: number }>('SELECT COUNT(*)::int AS n FROM terms'))!
  if (n > 0) return

  const createdAt = new Date().toISOString()
  await transaction(async (client) => {
    for (const term of SEED_CATEGORIES) {
      await client.query(INSERT, [term.id, term.kind, term.name, term.route ?? null, createdAt, null])
    }
  })
}
