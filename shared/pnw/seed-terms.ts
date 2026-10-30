/**
 * Replaces the earlier categories.ts (deleted). Categories and tags are real,
 * editable rows now (apps/server/data/terms-repo.ts, AGENTS.md "Server" (permissions)) - this
 * module only supplies what a brand-new database is seeded with: the site's
 * real WordPress categories, from seed-categories.ts (generated from the
 * client's archives.ts by apps/client/scripts/seed-categories.ts, so the
 * server never has to import client code).
 *
 * The mirror has no numeric term_id in scope (archives.ts is keyed by route,
 * not id), so a seeded category's own archive route is used as its stable id
 * here - a re-implementation detail, not a claim about the real WordPress
 * ids. Terms created inside the Hírkezelő get a random id and no route,
 * because the mirror has no archive page for them.
 */
import { MIRROR_CATEGORIES } from './seed-categories.ts'
import type { Term } from './types.ts'

/** The categories a fresh database starts with - the mirror's own WordPress categories. */
export const SEED_CATEGORIES: Term[] = MIRROR_CATEGORIES.map(({ route, name }) => ({
  id: route,
  kind: 'category' as const,
  name,
  route,
}))
