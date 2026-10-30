/**
 * The Szerkesztő's document model (AGENT.md 6.20) - shared by the editor
 * (src/components/szerkeszto/), the public renderer (src/components/
 * pagebuilder/), the generation scripts and the backend's validation
 * (server/lib/validation.ts).
 *
 * **Every page of the site is a `PageDocument`**: the mirrored pages ship as
 * default documents bundled with the client (src/data/pages/), a page edited
 * in the Szerkesztő is a full document in the database that replaces its
 * default, and a page created there is a document too. One renderer
 * (PageRenderer.tsx) draws all of them through the same Divi components, and a
 * default document renders byte-for-byte what the generated component it
 * replaced rendered (scripts/render-pages.ts is that gate). An *edited* page
 * carries no such guarantee - what it looks like is its editor's choice.
 */
import type { Align } from './types.ts'
import type { RichContent } from './rich-content.ts'

/** Divi's column widths, named as fractions of the row. Lives here so shared/ never imports from src/. */
export type ColumnSpan = '4_4' | '3_4' | '2_3' | '3_5' | '2_5' | '1_2' | '1_3' | '1_4' | '1_5' | '1_6'

export const COLUMN_SPANS: ColumnSpan[] = ['4_4', '3_4', '2_3', '3_5', '2_5', '1_2', '1_3', '1_4', '1_5', '1_6']

/** Divi's text-module alignment (note `justified`, not CSS's `justify`). */
export type TextAlign = 'left' | 'center' | 'right' | 'justified'

/* --- design settings ------------------------------------------------------- */

/**
 * Structured design settings on a section, row, column or module (AGENT.md
 * 6.20). Never raw CSS: every value is a number in a range, an enum or a
 * validated colour, and they are rendered as one generated `<style>` element
 * per document (src/lib/designCss.ts) because the mirror's own stylesheets
 * mark nearly everything `!important`, which an inline style cannot beat.
 */
export type Design = {
  /** Text colour. */
  color?: string
  /** Background colour. */
  background?: string
  /** Font size in px. */
  fontSize?: number
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  /** Spacing in px. */
  paddingTop?: number
  paddingBottom?: number
  marginTop?: number
  marginBottom?: number
  borderWidth?: number
  borderColor?: string
}

export const DESIGN_NUMBER_LIMITS = {
  fontSize: [8, 120],
  fontWeight: [100, 900],
  paddingTop: [0, 400],
  paddingBottom: [0, 400],
  marginTop: [0, 400],
  marginBottom: [0, 400],
  borderWidth: [0, 20],
} as const

/* --- modules --------------------------------------------------------------- */

/** An image as the modules carry it - exactly the props the generated pages passed. */
export type PageImage = {
  src: string
  alt?: string
  width?: number
  height?: number
  srcSet?: string
  sizes?: string
  /** Carried from the mirror: an image with no size must not be lazy (AGENT.md 4.22). */
  loading?: 'lazy' | 'eager'
}

export type FeedItem = {
  slug: string
  date?: string
  author?: { name: string; to: string }
}

export type SocialNetwork = { network: string; href: string; title: string; label: string }

export type GalleryItem = PageImage & { full?: string }

export type Slide = { image: string; heading?: string; text?: string }

export type PricingTable = { title: string; sum?: string; items: string[] }

export type HeaderButton = { label: string; to?: string; href?: string }

/**
 * Fields every node carries beyond its own:
 * - `index` - the Divi number its class wears (`et_pb_text_12`), which is what
 *   the page's generated design stylesheet targets. A converted module keeps
 *   its original index wherever it is moved, so it keeps its look; a module
 *   created in the editor gets `max(existing of its kind) + 1`, so it can never
 *   collide with a rule meant for another module. Filled in by
 *   `normalizeDocument` when missing (documents saved by the v1 builder).
 * - `className` - extra classes the mirror put on it (`et_pb_with_border`).
 */
/** Divi's entrance animations as the site uses them (text and blurb modules). */
export const MODULE_ANIMATIONS = ['fade', 'fold', 'foldBottom', 'bounce'] as const
export type ModuleAnimation = (typeof MODULE_ANIMATIONS)[number]

type NodeBase = { id: string; index?: number; className?: string; design?: Design; animation?: ModuleAnimation }

export type PageModule = NodeBase &
  (
    | { kind: 'text'; align?: TextAlign; bgLayout?: 'light' | 'dark'; content: RichContent }
    | ({ kind: 'image'; href?: string } & PageImage)
    | { kind: 'button'; label: string; to?: string; href?: string; align?: Align; icon?: string }
    | {
        kind: 'blurb'
        title?: string
        titleHref?: string
        /** Link around the icon/image (Divi's clickable blurb). */
        iconHref?: string
        image?: PageImage
        icon?: string
        position?: 'top' | 'left' | 'right'
        align?: TextAlign
        content: RichContent
      }
    | { kind: 'divider' }
    | { kind: 'video'; url: string; title?: string }
    | { kind: 'toggle'; title: string; defaultOpen?: boolean; content: RichContent }
    | {
        kind: 'post-feed'
        items: FeedItem[]
        columns?: 1 | 2 | 3
        align?: Align
        hasOlder?: boolean
        /** Further pages of the feed (/<page>/page/2/ ...), each with the items it lists. */
        olderPages?: FeedItem[][]
        /** Prepends what is published through the Hírkezelő (the home page's two feeds). */
        includeLive?: boolean
      }
    | {
        kind: 'team-member'
        name: string
        position?: string
        image?: PageImage
        headingLevel?: 4 | 6
        align?: Align
        content?: RichContent
      }
    | { kind: 'social-follow'; networks: SocialNetwork[]; align?: Align }
    | { kind: 'number-counter'; value: number; title: string; suffix?: string }
    | { kind: 'testimonial'; author: string; portrait?: string; align?: TextAlign; content: RichContent }
    | { kind: 'pricing-tables'; tables: PricingTable[] }
    | { kind: 'hero-slider'; slides: Slide[]; intervalMs?: number; headerOffset?: string }
    | { kind: 'gallery'; items: GalleryItem[]; perPage?: number }
    | { kind: 'fullwidth-header'; heading: string; text?: string; buttons?: HeaderButton[]; align?: Align }
    | { kind: 'file-block'; embed: string; href: string; label: string; buttonLabel: string; embedLabel: string }
  )

export type PageModuleKind = PageModule['kind']

export const MODULE_KINDS: PageModuleKind[] = [
  'text',
  'image',
  'button',
  'blurb',
  'divider',
  'video',
  'toggle',
  'post-feed',
  'team-member',
  'social-follow',
  'number-counter',
  'testimonial',
  'pricing-tables',
  'hero-slider',
  'gallery',
  'fullwidth-header',
  'file-block',
]

/** The kinds the editor's "+ Modul" picker offers inside a column (a file block only fits a docs page's frame). */
export const COLUMN_MODULE_KINDS: PageModuleKind[] = MODULE_KINDS.filter((kind) => kind !== 'file-block')

/* --- layout ---------------------------------------------------------------- */

export type PageColumn = NodeBase & {
  span: ColumnSpan
  /** Divi's `et-last-child`. Absent: the last column of its row. */
  last?: boolean
  modules: PageModule[]
}

export type PageRow = NodeBase & { gutters?: 2 | 3 | 4; equalColumns?: boolean; columns: PageColumn[] }

export type PageSection = NodeBase & {
  /** The hero band: the first section of a page, Divi's `et_pb_section_first`. */
  first?: boolean
  dividerTop?: boolean
  dividerBottom?: boolean
  /** Divi's `et_pb_with_background` (`background-size: cover`). Absent: true when `background.image` is set. */
  withBackground?: boolean
  /** A section whose modules sit directly in it - `modules` instead of `rows` (the home slider). */
  fullwidth?: boolean
  background?: { color?: string; image?: string }
  rows: PageRow[]
  /** Only in a fullwidth section. */
  modules?: PageModule[]
}

/** Which frame renders around the sections. */
export type PageTemplate = 'builder' | 'docs' | 'post' | 'classic'

export const PAGE_TEMPLATES: PageTemplate[] = ['builder', 'docs', 'post', 'classic']

export type PageDocument = {
  /** Default `builder`: `#main-content > article` around the Divi tree. */
  template?: PageTemplate
  /**
   * The page's scope class (`page-nyolcadikos`) - what its generated design
   * stylesheet is namespaced under. Absent: `page-builder`, the design every
   * page created in the Szerkesztő wears (builder-page.css).
   */
  scope?: string
  /** The `<article>`'s classes (builder, post, classic). */
  articleClass?: string
  sections: PageSection[]
  /**
   * Divi's "link options": a whole module, row or column that opens a URL when
   * clicked. `class` is the node's Divi class (`et_pb_blurb_3`, `et_pb_column_4`).
   */
  linkOptions?: { class: string; url: string; target?: '_blank' | '_self' }[]
  /** docs: the document in src/data/docs.ts this page is, which the BetterDocs frame is built from. */
  docsSlug?: string
  /** docs: the body is WordPress's password form, replaced by a note. */
  protected?: boolean
  /** docs: modules sitting in the frame itself rather than in a section (the PDF file block). */
  body?: PageModule[]
  /** post: the mirror's per-post data. */
  post?: { slug: string; date: string; articleId: string; bodyClasses: string[] }
  /** classic: the heading and the prose. */
  heading?: string
  content?: RichContent
}

export type PageStatus = 'draft' | 'publish'

/** Where a page comes from: the mirror (it has a bundled default) or created in the Szerkesztő. */
export type PageOrigin = 'mirror' | 'custom'

/**
 * One row of the `pages` table: a page saved in the Szerkesztő. For a mirrored
 * route it is an *edit* of the bundled default - or, with `deleted`, a
 * tombstone; a missing row means "use the default". `slug` is set only for
 * custom pages (their route is `/<slug>/`).
 */
export type StoredPage = {
  id: string
  route: string
  origin: PageOrigin
  template: PageTemplate
  deleted: boolean
  slug?: string
  title: string
  description: string
  /** Null for a tombstone. */
  document: PageDocument | null
  status: PageStatus
  authorId: string
  createdAt: string
  modifiedAt: string
  modifiedById?: string
}

/** What `/api/public/site` hands the public site: published edits and tombstones, no ids or authors. */
export type PublicPage = {
  route: string
  title: string
  description: string
  deleted: boolean
  document: PageDocument | null
}

/* --- the menu ------------------------------------------------------------ */

/** Structurally the same as src/data/site.ts's MenuItem, which shared/ cannot import. */
export type MenuNode = {
  label: string
  to?: string
  href?: string
  children?: MenuNode[]
}

/** Both menus of the site: the main navigation and the green top bar's links. */
export type SiteMenu = {
  primary: MenuNode[]
  secondary: MenuNode[]
}

/* --- the document library (Dokumentumtár) ------------------------------------- */

/**
 * One entry of the library. With a `file` the listings link straight to the
 * uploaded (or external) file; without one they link to the mirrored page at
 * /docs/<slug>/, as the original did.
 */
export type LibraryDoc = {
  slug: string
  title: string
  file?: string
}

export type LibraryCategory = {
  slug: string
  title: string
  docs: LibraryDoc[]
}

/** The whole edited library - categories in order, each with its documents in order. */
export type DocLibrary = {
  categories: LibraryCategory[]
}

/** Everything the public site reads from the Szerkesztő, in one fetch (SiteContentProvider.tsx). */
export type PublicSiteContent = {
  pages: PublicPage[]
  menu: SiteMenu | null
  library: DocLibrary | null
}

/* --- ids ------------------------------------------------------------------ */

let counter = 0

/** Unique within a document; the editor mints these for every new section/row/column/module. */
export function nodeId(prefix: string): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}
