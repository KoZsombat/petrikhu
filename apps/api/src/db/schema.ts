import { randomUUID } from "node:crypto";
import {
  boolean,
  customType,
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
    published: boolean("published").notNull().default(false),
    status: text("status", { enum: ["draft", "pending", "published"] })
      .notNull()
      .default("draft"),
    reviewNote: text("reviewNote"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("posts_slug_idx").on(table.slug)],
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
