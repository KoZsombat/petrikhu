import { randomUUID } from "node:crypto";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export * from "./auth-schema";
import { user } from "./auth-schema";

const bytea = customType<{
  data: Buffer;
  driverData: Buffer;
  notNull: true;
  default: false;
}>({
  dataType() {
    return "bytea";
  },
});

/** Editable public-site settings. One row per key; the admin panel owns the values. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Additional permissions granted to a user on top of their role defaults. */
export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.permission] })],
);

export const posts = pgTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    /** The munkaközösség-vezető who owns the draft; reviewers may edit but never re-own it. */
    authorId: text("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Plain text: search, fallback rendering, admin editing. */
    content: text("content").notNull(),
    /** Imported legacy HTML; rendered by the public article page when present. */
    contentHtml: text("contentHtml"),
    category: text("category").notNull().default("Hírek"),
    image: text("image"),
    gallery: jsonb("gallery").$type<string[]>().notNull().default([]),
    /**
     * Derived from `status` on every write; kept because the public contract exposes it.
     * `status` is the source of truth and only the review endpoint may publish.
     */
    published: boolean("published").notNull().default(false),
    status: text("status", {
      enum: ["draft", "pending", "revision", "published"],
    })
      .notNull()
      .default("draft"),
    /** Rejection reason written by the reviewer; cleared on resubmit and on approval. */
    reviewNote: text("reviewNote"),
    reviewerId: text("reviewerId").references(() => user.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submittedAt"),
    reviewedAt: timestamp("reviewedAt"),
    /** Set when a reviewer approves; never derived from `createdAt`. */
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("posts_slug_idx").on(table.slug),
    index("posts_author_idx").on(table.authorId),
    index("posts_status_idx").on(table.status),
  ],
);

/** Append-only trail of every workflow transition; `AGENT.md` documents the action names. */
export const postAuditLog = pgTable(
  "post_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    postId: text("postId").references(() => posts.id, {
      onDelete: "set null",
    }),
    actorId: text("actorId").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    fromStatus: text("fromStatus"),
    toStatus: text("toStatus"),
    note: text("note"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("post_audit_log_post_idx").on(table.postId)],
);

export const teachers = pgTable(
  "teachers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    email: text("email"),
    room: text("room"),
    photo: text("photo"),
    sortOrder: integer("sortOrder").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("teachers_name_idx").on(table.name)],
);

export const postCategories = pgTable(
  "post_categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("post_categories_slug_idx").on(table.slug)],
);

export const documentCategories = pgTable(
  "document_categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("document_categories_slug_idx").on(table.slug)],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    categoryId: text("categoryId")
      .notNull()
      .references(() => documentCategories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** `/media/...`, `/uploads/...` or an absolute URL; null = protected/archived. */
    file: text("file"),
    protected: boolean("protected").notNull().default(false),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("documents_category_slug_idx").on(table.categoryId, table.slug),
  ],
);

/** Uploaded images. Stored in the database so Docker volumes and pg_dump carry them. */
export const media = pgTable(
  "media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
);
