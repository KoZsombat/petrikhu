/**
 * Shared between the Vite frontend (src/) and the Express backend (server/) -
 * see AGENT.md 6.15. Both run modern TS-stripping tooling, so this is plain
 * `.ts` with no build step, imported by relative path from either side.
 */

export type Align = 'left' | 'center' | 'right'

/**
 * The inline styles the mirror's text carries and the Szerkesztő may write
 * (AGENT.md 6.20): the properties `styleProp()` in scripts/extract.ts meets in
 * the mirror, camelCased like React's `style`. Validated server-side - never
 * free CSS.
 */
export const RICH_STYLE_KEYS = [
  'color',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'letterSpacing',
  'textTransform',
  'textAlign',
  'lineHeight',
] as const

export type RichStyleKey = (typeof RICH_STYLE_KEYS)[number]

export type RichStyle = Partial<Record<RichStyleKey, string>>

/**
 * One styled stretch of text. `bold`/`italic` are all the Hírkezelő's editor
 * writes; `color`, `href` and `underline` exist for the Szerkesztő (AGENT.md
 * 6.19), whose content comes from the mirror's own markup - coloured spans,
 * links, underlines. A `\n` inside `text` renders as a line break.
 */
export type TextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** A CSS colour, e.g. `#72c3b6`. Validated server-side (server/lib/validation.ts). */
  color?: string
  /** A root-relative in-app route (`/nyolcadikos/`) or an absolute http(s)/mailto/tel URL. */
  href?: string
  /** Any other whitelisted inline style (a `<span style>` on the mirror's pages). */
  style?: RichStyle
}

/**
 * The plugin's real editor is WordPress TinyMCE - full HTML. This repo never
 * renders raw HTML (no dangerouslySetInnerHTML, see AGENT.md), so the content
 * is this small structured model instead: one block per paragraph/heading/
 * list-item/quote, each holding styled runs. It renders through real JSX
 * everywhere (editor, preview modal, review screen, published view).
 */
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'bulleted-list'
  | 'numbered-list'
  | 'blockquote'
  /** The mirror's non-`<p>` inline wrapper (AGENT.md 4.2) - Divi gives `<p>` a margin, a `<div>` none. */
  | 'div'
  /** Inline content straight in the module, with no block element around it. */
  | 'plain'
  /** A table (Hírkezelő): the cells are in `table`, `runs` stays a single empty run. */
  | 'table'
  /**
   * The media blocks of a news post imported from the mirror (AGENT.md 6.24):
   * a picture, a gallery and an embedded iframe. Like `table`, their data sits
   * in its own field and `runs` stays a single empty run. The editor keeps them
   * but cannot create them.
   */
  | 'image'
  | 'gallery'
  | 'embed'

export type RichTable = { header: boolean; rows: string[][] }

/** `src` is a root-relative upload (`/uploads/...`) or an http(s) URL; `href` where the picture links to. */
export type RichImage = { src: string; alt: string; caption?: string; href?: string; width?: number; height?: number }

/** One picture of a gallery; `full` is the full-size file the thumbnail opens. */
export type RichGalleryItem = { src: string; alt: string; full?: string }

/**
 * An iframe embed - a YouTube video, a Sway, a ThingLink card. Only https
 * sources on an allow-listed host (EMBED_HOSTS) are stored or rendered.
 * `aspect` is height/width for a responsive box; `height` a fixed pixel height.
 */
export type RichEmbed = { src: string; title?: string; aspect?: number; height?: number }

export const EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'sway.office.com',
  'sway.cloud.microsoft',
  'www.thinglink.com',
  'view.genial.ly',
  'view.genially.com',
  'online.fliphtml5.com',
  'www.facebook.com',
  'docs.google.com',
  'www.canva.com',
  'padlet.com',
] as const

export function isEmbedSrc(src: string): boolean {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && (EMBED_HOSTS as readonly string[]).includes(url.hostname)
  } catch {
    return false
  }
}

export type RichTextBlock = {
  id: string
  type: BlockType
  align?: Align | 'justify'
  /** Only read when `type === 'heading'`; a heading without it is an <h2>, as it always was. */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  /** Nesting depth of a list item (0 = the outer list). */
  depth?: number
  /** Whitelisted block styles besides `textAlign`, which `align` carries. */
  style?: RichStyle
  /** Only for `type === 'table'`: plain-text cells, row by row; the first row is a header when `header`. */
  table?: RichTable
  /** Only for `type === 'image'`. */
  image?: RichImage
  /** Only for `type === 'gallery'`. */
  gallery?: RichGalleryItem[]
  /** Only for `type === 'embed'`. */
  embed?: RichEmbed
  runs: TextRun[]
}

export type RichTextDocument = RichTextBlock[]

export const STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  REVISION: 'pnw_revision',
  TEST_APPROVED: 'pnw_test_ok',
  ARCHIVED: 'pnw_archived',
  PUBLISH: 'publish',
  FUTURE: 'future',
  TRASH: 'trash',
} as const

export type PostStatus = (typeof STATUS)[keyof typeof STATUS]

/**
 * Accounts carry a plain set of these and nothing else - there are **no
 * roles** anywhere in this re-implementation (user decision, see AGENT.md
 * 6.16). The real plugin bundles the same `pnw_*` capabilities into three
 * WordPress roles; here every account is given its permissions one by one on
 * the Fiókok screen, so any mix is possible.
 */
export const CAPABILITY = {
  /** Write your own news: draft, edit your own draft/revision, submit for review. */
  SUBMIT_NEWS: 'pnw_submit_news',
  /** Review the queue: edit a pending post, approve, schedule, send back. */
  REVIEW_NEWS: 'pnw_review_news',
  /** Edit, archive and restore already-published news. */
  MANAGE_PUBLISHED: 'pnw_manage_published_news',
  /** See the statistics screen and the full audit log. */
  VIEW_AUDIT_LOG: 'pnw_view_audit_log',
  /** Create/edit/delete Hírkezelő accounts (no equivalent in the real plugin). */
  MANAGE_USERS: 'pnw_manage_users',
  /**
   * Create new categories and tags from inside the editor. Using existing
   * ones needs no permission at all - every account may pick any category
   * or tag (see AGENT.md 6.16).
   */
  MANAGE_TERMS: 'pnw_manage_terms',
  /**
   * The Szerkesztő (/szerkeszto/): edit the content of the mirrored pages,
   * create/delete new pages and edit the main menu (AGENT.md 6.19). No
   * equivalent in the real plugin.
   */
  MANAGE_PAGES: 'pnw_manage_pages',
  /**
   * The Dokumentumtár section of the Szerkesztő: add, remove, replace and
   * organise the documents of the library (AGENT.md 6.24). Separate from
   * MANAGE_PAGES so someone can look after the documents without being able
   * to rewrite the site's pages.
   */
  MANAGE_LIBRARY: 'pnw_manage_library',
} as const

export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY]

export type SessionUser = {
  id: string
  displayName: string
  permissions: Capability[]
}

/** A user account as the account-management screen (Users.tsx) sees it - never a password/hash. */
export type Account = {
  id: string
  username: string
  displayName: string
  permissions: Capability[]
}

export type TermKind = 'category' | 'tag'

/**
 * A category or a tag. Both live in the same `terms` table (server/data/
 * terms-repo.ts) and both can be created from the editor by anyone holding
 * `pnw_manage_terms`.
 */
export type Term = {
  id: string
  kind: TermKind
  name: string
  /**
   * The mirrored category archive this term is the same thing as
   * ("/kategoria/hirek/"), for the seeded categories only - it is what makes
   * a post's category a real link in the single-post template. Terms created
   * inside the Hírkezelő have no mirrored archive page, so no route.
   */
  route?: string
}

export type ImagePosition = 'top' | 'bottom'

/**
 * Where a post came from: written in the Hírkezelő, or imported from the
 * mirror of the old petrik.hu (AGENT.md 6.24). An imported post lives at its
 * original URL (`/<slug>/`) and is already listed by the mirror's own
 * archives, so it is left out of the "latest live news" the site prepends.
 */
export type PostOrigin = 'hirkezelo' | 'mirror'

export type Post = {
  id: string
  /** Stable from creation, even if the title is edited later - the public /hirek/:slug/ URL. */
  slug: string
  title: string
  content: RichTextDocument
  excerpt: string
  categoryIds: string[]
  tagIds: string[]
  /** Public URL path under /uploads/, or undefined. */
  featuredImage?: string
  /** Where the featured image sits in the article: above the text (the default) or below it. */
  imagePosition?: ImagePosition
  /** Absent: 'hirkezelo'. */
  origin?: PostOrigin
  authorId: string
  status: PostStatus
  reviewNote?: string
  lastReviewerId?: string
  lastReviewedAt?: string
  scheduledFor?: string
  scheduledById?: string
  archivedAt?: string
  archivedById?: string
  createdAt: string
  modifiedAt: string
  /** The post's own "date" - display date for publish/future, same as WordPress post_date. */
  date: string
}

export type AuditAction =
  | 'created_draft'
  | 'updated_draft'
  | 'submitted'
  | 'reviewer_edited'
  | 'rejected'
  | 'approved'
  | 'scheduled'
  | 'scheduled_published'
  | 'trashed'
  | 'published_updated'
  | 'published_archived'
  | 'archived_restored'
  | 'imported'

export type AuditEntry = {
  id: string
  postId: string
  userId: string | null
  action: AuditAction
  fromStatus: string
  toStatus: string
  note?: string
  createdAt: string
}

export type LoginErrorCode = 'empty_fields' | 'invalid_credentials' | 'no_access'

export type NoticeCode =
  | 'draft_saved'
  | 'submitted'
  | 'review_saved'
  | 'approved'
  | 'scheduled'
  | 'schedule_invalid'
  | 'rejected'
  | 'trashed'
  | 'published_updated'
  | 'published_archived'
  | 'archived_restored'
  | 'published_trashed'
  | 'production_only'
  | 'missing_fields'
  | 'category_required'
  | 'rejection_note_required'
  | 'save_error'
