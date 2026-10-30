import type { DocLibrary } from './page-types.ts'

/** A Creator-oldalak és a szerkesztett menü közös típusai (szerver + kliens). */

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
  /** Kukában van: az útvonal nem él, de visszaállítható. */
  deleted: boolean
  authorId: string
  createdAt: string
  modifiedAt: string
  modifiedById?: string
}

export type CreatorPageSummary = Omit<StoredCreatorPage, 'blocks'>

export type MenuLeaf = { label: string; href: string }
export type MenuItem = { label: string; href?: string; children?: MenuLeaf[] }

/** Amit a nyilvános oldal egyszerre tölt le: a kiadott oldalak és a (szerkesztett) menü. */
export type PublicSite = {
  pages: Pick<StoredCreatorPage, 'slug' | 'title' | 'description' | 'blocks'>[]
  menu: MenuItem[] | null
  /** A szerkesztett Dokumentumtár, vagy null: ilyenkor a beépített (dokumentumtar.json) él. */
  library: DocLibrary | null
}

/** Útvonalak, amiket az alkalmazás már használ: ilyen slugú oldal nem hozható létre. */
export const RESERVED_SLUGS = [
  'api',
  'uploads',
  'media',
  'creator',
  'dashboard',
  'preview',
  'components-preview',
  'bejelentkezes',
  'hirkezelo',
  'kereses',
]
