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

/**
 * Útvonalak, amiket az alkalmazás már használ: ilyen slugú oldal nem hozható létre, mert sosem lenne elérhető.
 * Két forrásból jön: a szerver saját útvonalai (server/app.ts) és az src/App.tsx rögzített útvonalai.
 * A beépített oldalak (pages.json) és a /dokumentumtar NEM foglaltak: azokat egy azonos slugú kiadott oldal
 * szándékosan felülírja. A tests/reserved-slugs.test.ts ellenőrzi, hogy a lista ne csússzon el az App.tsx-től.
 */
export const RESERVED_SLUGS = [
  // szerver (server/app.ts)
  'api',
  'uploads',
  'media',
  'healthz',
  'assets',
  // kliens (src/App.tsx)
  'about-us',
  'creator',
  'dashboard',
  'preview',
  'components-preview',
  'bejelentkezes',
  'hirkezelo',
  'kereses',
]
