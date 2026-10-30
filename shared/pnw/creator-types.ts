import type { DocLibrary } from './page-types.ts'

/** Shared types of the Creator pages and the edited menu (server + client). */

export type PageBlock = {
  component: string
  variant?: string
  values: Record<string, unknown>
}

export type CreatorPageStatus = 'draft' | 'publish'

export type StoredCreatorPage = {
  id: string
  slug: string
  title: string
  description: string
  blocks: PageBlock[]
  status: CreatorPageStatus
  /** In the trash: the route is not live, but it can be restored. */
  deleted: boolean
  authorId: string
  createdAt: string
  modifiedAt: string
  modifiedById?: string
}

export type CreatorPageSummary = Omit<StoredCreatorPage, 'blocks'>

export type MenuLeaf = { label: string; href: string }
export type MenuItem = { label: string; href?: string; children?: MenuLeaf[] }

/** What the public site downloads at once: the published pages and the (edited) menu. */
export type PublicSite = {
  pages: Pick<StoredCreatorPage, 'slug' | 'title' | 'description' | 'blocks'>[]
  menu: MenuItem[] | null
  /** The edited Dokumentumtár, or null: then the built-in one (dokumentumtar.json) is used. */
  library: DocLibrary | null
}

/**
 * Routes the application already uses: a page with such a slug cannot be created, because it would never be reachable.
 * They come from two sources: the server's own routes (server/app.ts) and the fixed routes of src/App.tsx.
 * The built-in pages (pages.json) and /dokumentumtar are NOT reserved: a published page with the same slug
 * deliberately overrides them. tests/reserved-slugs.test.ts checks that the list does not drift from App.tsx.
 */
export const RESERVED_SLUGS = [
  // server (server/app.ts)
  'api',
  'uploads',
  'media',
  'healthz',
  'assets',
  // client (src/App.tsx)
  'about-us',
  'creator',
  'dashboard',
  'preview',
  'components-preview',
  'bejelentkezes',
  'hirkezelo',
  'kereses',
]
