/**
 * Every request body the API accepts, and the shapes it returns. The server validates with these, the admin's
 * types (and forms) come from them. Public responses use the `Public*` types only: they never carry review
 * notes, author ids or other internal fields.
 */
import { z } from 'zod'
import { blocksSchema } from './blocks.ts'
import type { Block } from './blocks.ts'
import { isSafeHref } from './links.ts'
import { ROLES } from './roles.ts'
import type { Role } from './roles.ts'
import { SLUG_PATTERN } from './slug.ts'
import { richDocSchema } from './tiptap.ts'
import type { RichDoc } from './tiptap.ts'
import { AUDIT_ENTITY_TYPES, POST_STATUSES } from './workflow.ts'
import type { PageStatus, PostStatus } from './workflow.ts'

export const LOCALES = ['hu', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const localeSchema = z.enum(LOCALES)

/* --- auth and accounts ------------------------------------------------------ */

export const loginBody = z.object({
  username: z.string().trim().max(200),
  password: z.string().max(1000),
})

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 200

/** The one password rule, for the request bodies and for every server path that stores a password. */
export function passwordProblem(password: string): 'password_too_short' | 'password_too_long' | null {
  if (password.length < PASSWORD_MIN) return 'password_too_short'
  if (password.length > PASSWORD_MAX) return 'password_too_long'
  return null
}

const password = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value)
  if (problem) ctx.addIssue({ code: 'custom', message: problem })
})

export const changePasswordBody = z.object({ currentPassword: z.string().max(1000), newPassword: password })

export const usernameSchema = z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9._-]+$/, 'invalid_username')

export const userCreateBody = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  password,
})

export const userUpdateBody = userCreateBody.extend({ password: password.optional().or(z.literal('')) })

export type SessionUser = { id: string; username: string; displayName: string; role: Role; mustChangePassword?: boolean }
export type Account = SessionUser & { createdAt: string }

/* --- optimistic concurrency ------------------------------------------------ */

/** The version a document or setting was loaded at; a save that names an older one gets 409 `conflict`. */
export const versionField = z.number().int().min(0).max(2_000_000_000)

/** The 409 of a save that lost the race: who saved in between, when, and the version to overwrite with. */
export type ConflictInfo = { error: 'conflict'; savedBy: string | null; savedAt: string | null; version: number }

/* --- posts ------------------------------------------------------------------ */

export const postSaveBody = z.object({
  title: z.string().trim().max(300),
  excerpt: z.string().trim().max(1000).default(''),
  content: richDocSchema,
  categoryIds: z.array(z.string().max(200)).max(20).default([]),
  tagIds: z.array(z.string().max(200)).max(50).default([]),
  featuredImage: z.string().max(2000).regex(/^\/(uploads|media)\/[^\s]+$/).nullish(),
  imagePosition: z.enum(['top', 'bottom']).default('top'),
  /** `submit`: save and send for review (authors), otherwise save only. */
  command: z.enum(['draft', 'submit']).default('draft'),
  /** A new address (news.review only); a published post's old one keeps working (301). Empty: unchanged. */
  slug: z.string().trim().max(120).regex(SLUG_PATTERN, 'invalid_slug').optional().or(z.literal('')),
  /** Only for a scheduled post (news.review): its new publication time. */
  publishAt: z.iso.datetime({ offset: true }).optional(),
  /** Saving an existing post: the version it was loaded at (optimistic concurrency). Required by PUT. */
  version: versionField.optional(),
})
export type PostSaveBody = z.input<typeof postSaveBody>

export const reviewDecisionBody = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), note: z.string().trim().max(2000).default(''), publishAt: z.iso.datetime({ offset: true }).optional() }),
  z.object({ decision: z.literal('reject'), note: z.string().trim().max(2000) }),
])

export type Post = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: RichDoc
  categoryIds: string[]
  tagIds: string[]
  featuredImage: string | null
  imagePosition: 'top' | 'bottom'
  status: PostStatus
  authorId: string | null
  reviewNote: string | null
  reviewedById: string | null
  reviewedAt: string | null
  scheduledFor: string | null
  publishedAt: string | null
  archivedAt: string | null
  version: number
  /** In the trash: the status it had before. */
  trashedFrom: PostStatus | null
  createdAt: string
  updatedAt: string
  legacy: boolean
}
export type PostSummary = Omit<Post, 'content'>

/* --- pages ------------------------------------------------------------------- */

export const pageSaveBody = z.object({
  slug: z.string().trim().max(80).regex(SLUG_PATTERN, 'invalid_slug').optional().or(z.literal('')),
  locale: localeSchema.default('hu'),
  title: z.string().trim().min(1, 'missing_title').max(200),
  description: z.string().trim().max(500).default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  blocks: blocksSchema,
  translationOf: z.uuid().nullish(),
  /** Saving an existing page: the version it was loaded at. Required by PUT. */
  version: versionField.optional(),
})
export type PageSaveBody = z.input<typeof pageSaveBody>

export type Page = {
  id: string
  slug: string
  locale: Locale
  title: string
  description: string
  status: PageStatus
  blocks: Block[]
  translationOf: string | null
  authorId: string | null
  updatedById: string | null
  createdAt: string
  updatedAt: string
  version: number
}
export type PageSummary = Omit<Page, 'blocks'>

/* --- menu, library, terms ------------------------------------------------------ */

// A path on the site, whose query may hold spaces (`/hirek?kategoria=Esti munkarend` in the seeded menus; the path
// itself may not), or an http(s) URL.
const menuHref = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/[^\s?#]*([?#][^\t\n\r]*)?|https?:\/\/[^\s]+)$/, 'invalid_href')
  .refine(isSafeHref, 'invalid_href')
const menuLabel = z.string().trim().min(1).max(80)

export const menuSchema = z
  .array(
    z.union([
      z.object({ label: menuLabel, children: z.array(z.object({ label: menuLabel, href: menuHref })).max(30) }),
      z.object({ label: menuLabel, href: menuHref }),
    ]),
  )
  .min(1)
  .max(30)
export type Menu = z.output<typeof menuSchema>
export type MenuItem = Menu[number]

export const librarySchema = z
  .object({
    categories: z
      .array(
        z.object({
          slug: z.string().max(120).regex(SLUG_PATTERN),
          title: z.string().trim().min(1).max(200),
          docs: z
            .array(
              z.object({
                slug: z.string().max(120).regex(SLUG_PATTERN),
                title: z.string().trim().min(1).max(300),
                file: z.string().max(2000).regex(/^(\/uploads\/|\/media\/|https?:\/\/)[^\s]+$/).optional(),
              }),
            )
            .max(500),
        }),
      )
      .max(200),
  })
  // Category slugs are page anchors: unique. A document's slug only has to be unique within its category (the
  // same document may be listed under two categories, as in the seeded library).
  .superRefine((library, ctx) => {
    const categories = new Set<string>()
    library.categories.forEach((category, i) => {
      if (categories.has(category.slug)) ctx.addIssue({ code: 'custom', message: 'duplicate_slug', path: ['categories', i, 'slug'] })
      categories.add(category.slug)
      const docs = new Set<string>()
      category.docs.forEach((doc, d) => {
        if (docs.has(doc.slug)) ctx.addIssue({ code: 'custom', message: 'duplicate_slug', path: ['categories', i, 'docs', d, 'slug'] })
        docs.add(doc.slug)
      })
    })
  })
export type Library = z.output<typeof librarySchema>

export const menuSaveBody = z.object({ menu: menuSchema, version: versionField })
export const librarySaveBody = z.object({ library: librarySchema, version: versionField })

export const termCreateBody = z.object({
  kind: z.enum(['category', 'tag']),
  name: z.string().trim().min(1).max(60),
  parentId: z.string().max(200).nullish(),
})
export type Term = { id: string; kind: 'category' | 'tag'; name: string; parentId: string | null }

/* --- preview ----------------------------------------------------------------- */

export const previewBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('page'), page: pageSaveBody }),
  z.object({ kind: z.literal('post'), post: postSaveBody }),
])

/* --- public DTOs ----------------------------------------------------------------- */

export type PublicPostSummary = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  categories: string[]
  image: string | null
}
export type PublicPost = PublicPostSummary & { content: RichDoc; featuredImage: string | null; imagePosition: 'top' | 'bottom' }
export type PublicPage = {
  slug: string
  locale: Locale
  title: string
  description: string
  blocks: Block[]
  /** The other language's version of this page, if there is one. */
  alternate: { locale: Locale; slug: string } | null
}
export type PublicSite = {
  menu: Menu
  library: Library
  /** Published pages that exist in both languages: the language switch links them. */
  translations: { hu: string; en: string }[]
}

/** What the sitemap needs: public addresses and modification dates, nothing else. */
export type PublicSitemap = {
  pages: { locale: Locale; slug: string; updatedAt: string }[]
  posts: { slug: string; updatedAt: string }[]
  translations: { hu: string; en: string }[]
}

export const linkSchema = z.string().refine(isSafeHref)

/* --- query strings --------------------------------------------------------------- */

/**
 * A non-negative integer query parameter: digits only (so `Infinity`, `1e9`, `-1`, `1.5` are refused, never
 * reaching SQL), between `min` and `max`; missing or empty → `fallback`.
 */
export const queryInt = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d{0,9}$/, 'invalid_integer')
    .optional()
    .transform((value) => (value === undefined || value === '' ? fallback : Number(value)))
    .pipe(z.number().int().min(min).max(max))

const queryText = (max: number) => z.string().trim().max(max).optional()

export const PUBLIC_POSTS_MAX_LIMIT = 100
export const PUBLIC_POSTS_MAX_OFFSET = 1000

/** GET /api/public/posts */
export const publicPostsQuery = z.object({
  limit: queryInt(1, PUBLIC_POSTS_MAX_LIMIT, 10),
  offset: queryInt(0, PUBLIC_POSTS_MAX_OFFSET, 0),
  category: queryText(120),
  q: queryText(200),
})

/** GET /api/posts (admin) */
export const adminPostsQuery = z.object({
  status: z.enum(POST_STATUSES),
  q: queryText(200),
  page: queryInt(1, 10_000, 1),
})

/** GET /api/pages (admin) */
export const pagesQuery = z.object({ locale: localeSchema.optional().or(z.literal('')) })

/** GET /api/media (admin): images or documents. */
export const mediaQuery = z.object({ page: queryInt(1, 10_000, 1), kind: z.enum(['images', 'documents']).default('images') })

const queryDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?)?$/, 'invalid_date')
  .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), 'invalid_date')
  .optional()

/** GET /api/media/lookup */
export const mediaLookupQuery = z.object({ path: z.string().max(2000).regex(/^\/(uploads|media)\/[^\s]+$/, 'invalid_path') })

/** GET /api/audit */
export const auditQuery = z.object({
  limit: queryInt(1, 200, 50),
  page: queryInt(1, 10_000, 1),
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional().or(z.literal('')),
  entityId: queryText(200),
  userId: queryText(200),
  action: queryText(60),
  from: queryDate,
  to: queryDate,
  imported: z.enum(['1', '']).optional(),
})

/** GET /api/public/resolve: a site path (decoded), e.g. `/regi-oldal`, `/en/old`, `/hirek/regi-hir`. */
export const resolveQuery = z.object({ path: z.string().max(400).regex(/^\/[^\s?#]*$/, 'invalid_path') })
