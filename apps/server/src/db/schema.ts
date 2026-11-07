/**
 * The database schema. `drizzle-kit generate` turns changes here into SQL migrations in ../../drizzle
 * (never edit a migration that has already run; add a new one). The four auth tables follow Better Auth's
 * model (user, session, account, verification).
 */
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { boolean, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { Block } from '@petrik/shared/blocks'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const created = () => ts('created_at').notNull().defaultNow()
const updated = () => ts('updated_at').notNull().defaultNow()

/* --- accounts (Better Auth) ---------------------------------------------------- */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  /** Display name. */
  name: text('name').notNull(),
  /** Better Auth wants an e-mail; login is by username, so this is a placeholder for most accounts. */
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  role: text('role').notNull().default('author'),
  createdAt: created(),
  updatedAt: updated(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: created(),
    updatedAt: updated(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
)

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: created(),
  updatedAt: updated(),
})

/* --- content --------------------------------------------------------------------- */

const userRef = (name: string) => text(name).references(() => users.id, { onDelete: 'set null' })

/**
 * Pages and news posts. Both are a list of blocks; a post's body is one `richText` block. The workflow
 * columns (review_*, scheduled_*, archived_*, submitted_at) are only used by posts.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type', { enum: ['page', 'post'] }).notNull(),
    slug: text('slug').notNull(),
    locale: text('locale', { enum: ['hu', 'en'] }).notNull().default('hu'),
    title: text('title').notNull(),
    /** Page: meta description. Post: excerpt. */
    description: text('description').notNull().default(''),
    blocks: jsonb('blocks').$type<Block[]>().notNull(),
    status: text('status').notNull(),
    authorId: userRef('author_id'),
    updatedById: userRef('updated_by_id'),
    createdAt: created(),
    updatedAt: updated(),
    /** When it went (or goes) public; the date shown on a post. */
    publishedAt: ts('published_at'),
    /** The Hungarian document this one translates (English pages only). */
    translationOf: uuid('translation_of').references((): AnyPgColumn => documents.id, { onDelete: 'set null' }),
    /** Lowercased, accent-free title + text, maintained on every save (search). */
    searchText: text('search_text').notNull().default(''),
    /** Imported from the old petrik.hu. */
    legacy: boolean('legacy').notNull().default(false),
    featuredImage: text('featured_image'),
    imagePosition: text('image_position', { enum: ['top', 'bottom'] }).notNull().default('top'),
    submittedAt: ts('submitted_at'),
    reviewNote: text('review_note'),
    reviewedById: userRef('reviewed_by_id'),
    reviewedAt: ts('reviewed_at'),
    scheduledFor: ts('scheduled_for'),
    scheduledById: userRef('scheduled_by_id'),
    archivedAt: ts('archived_at'),
    archivedById: userRef('archived_by_id'),
    /** A trashed post's status before the trash: deleting a once-public post needs `news.manage`. */
    trashedFrom: text('trashed_from'),
  },
  (t) => [
    uniqueIndex('documents_type_locale_slug_idx').on(t.type, t.locale, t.slug),
    index('documents_type_status_published_idx').on(t.type, t.status, t.publishedAt),
    index('documents_type_status_updated_idx').on(t.type, t.status, t.updatedAt),
    index('documents_author_idx').on(t.authorId),
    index('documents_translation_idx').on(t.translationOf),
  ],
)

/** Categories and tags. A category may have a parent: filtering by it includes its children. */
export const terms = pgTable(
  'terms',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['category', 'tag'] }).notNull(),
    name: text('name').notNull(),
    parentId: text('parent_id').references((): AnyPgColumn => terms.id, { onDelete: 'set null' }),
    createdAt: created(),
    createdById: userRef('created_by_id'),
  },
  (t) => [uniqueIndex('terms_kind_name_idx').on(t.kind, sql`lower(${t.name})`)],
)

export const documentTerms = pgTable(
  'document_terms',
  {
    documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
    termId: text('term_id').notNull().references(() => terms.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.termId] }), index('document_terms_term_idx').on(t.termId)],
)

/** Site-wide settings, one JSON value per key: `menu.hu`, `menu.en`, `library`, `seeded`. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updated(),
  updatedById: userRef('updated_by_id'),
})

/* --- media --------------------------------------------------------------------------- */

/**
 * Every file the site serves that is not code: uploads (/uploads/...) and the old site's files (/media/...).
 * The bytes live here so one pg_dump is a full backup. `data` is STORAGE EXTERNAL (see the migration), so
 * serving a range reads only that slice.
 */
export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: text('path').notNull().unique(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    data: bytea('data').notNull(),
    createdAt: created(),
    createdById: userRef('created_by_id'),
  },
  (t) => [index('media_created_idx').on(t.createdAt)],
)

/** Resized WebP / AVIF copies of an image, made with sharp at upload (or on first request for old files). */
export const mediaVariants = pgTable(
  'media_variants',
  {
    mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
    width: integer('width').notNull(),
    format: text('format', { enum: ['webp', 'avif'] }).notNull(),
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.width, t.format] })],
)

/* --- audit and previews -------------------------------------------------------------------- */

/** Who did what to which entity. `subject` keeps the entity's name, so it stays readable after deletion. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: created(),
    userId: userRef('user_id'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    subject: text('subject'),
    action: text('action').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note'),
  },
  (t) => [index('audit_entity_idx').on(t.entityType, t.entityId), index('audit_created_idx').on(t.createdAt), index('audit_user_idx').on(t.userId)],
)

/** Unsaved content sent from the admin for the public site to render; expires after a day. */
export const previews = pgTable('previews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  createdAt: created(),
})
