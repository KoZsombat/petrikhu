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
const password = z.string().min(PASSWORD_MIN, 'password_too_short').max(200)

export const changePasswordBody = z.object({ currentPassword: z.string().max(1000), newPassword: password })

export const usernameSchema = z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9._-]+$/, 'invalid_username')

export const userCreateBody = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  password,
})

export const userUpdateBody = userCreateBody.extend({ password: password.optional().or(z.literal('')) })

export type SessionUser = { id: string; username: string; displayName: string; role: Role }
export type Account = SessionUser & { createdAt: string }

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
}
export type PageSummary = Omit<Page, 'blocks'>

/* --- menu, library, terms ------------------------------------------------------ */

const menuHref = z.string().trim().max(300).regex(/^(\/[^\s]*|https?:\/\/[^\s]+)$/, 'invalid_href').refine(isSafeHref, 'invalid_href')
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
  .superRefine((library, ctx) => {
    const seen = new Set<string>()
    for (const category of library.categories) {
      for (const slug of [`c:${category.slug}`, ...category.docs.map((doc) => `d:${doc.slug}`)]) {
        if (seen.has(slug)) ctx.addIssue({ code: 'custom', message: 'duplicate_slug', path: ['categories'] })
        seen.add(slug)
      }
    }
  })
export type Library = z.output<typeof librarySchema>

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
