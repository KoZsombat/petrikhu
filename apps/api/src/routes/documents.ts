import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { documentCategories, documents } from "../db/schema";
import { requirePermission } from "../middleware/auth";
import {
  categoryInputSchema,
  categoryUpdateSchema,
  documentInputSchema,
  documentUpdateSchema,
} from "../types/docTypes";
import { validateJson } from "../validation";

const toDocument = (document: typeof documents.$inferSelect) => ({
  id: document.id,
  categoryId: document.categoryId,
  slug: document.slug,
  title: document.title,
  file: document.file,
  protected: document.protected,
  sortOrder: document.sortOrder,
});

const toCategory = (
  category: typeof documentCategories.$inferSelect,
  docs: ReturnType<typeof toDocument>[],
) => ({
  id: category.id,
  slug: category.slug,
  title: category.title,
  sortOrder: category.sortOrder,
  docs,
});

export const registerDocumentRoutes = (app: Hono) => {
  app.get("/api/documents", async (c) => {
    const [categories, rows] = await Promise.all([
      db
        .select()
        .from(documentCategories)
        .orderBy(asc(documentCategories.sortOrder), asc(documentCategories.title)),
      db
        .select()
        .from(documents)
        .orderBy(asc(documents.sortOrder), asc(documents.title)),
    ]);

    return c.json({
      categories: categories.map((category) =>
        toCategory(
          category,
          rows
            .filter((document) => document.categoryId === category.id)
            .map(toDocument),
        ),
      ),
    });
  });

  app.get(
    "/api/admin/documents",
    requirePermission("documents.view"),
    async (c) => {
      const rows = await db
        .select()
        .from(documents)
        .orderBy(asc(documents.categoryId), asc(documents.sortOrder));

      return c.json(rows.map(toDocument));
    },
  );

  app.post(
    "/api/admin/documents",
    requirePermission("documents.manage"),
    validateJson(documentInputSchema),
    async (c) => {
      const input = c.req.valid("json");

      const conflict = await db.query.documents.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.categoryId, input.categoryId), eq(table.slug, input.slug)),
      });

      if (conflict) {
        return c.json({ error: "Slug already exists in the category" }, 409);
      }

      const [created] = await db.insert(documents).values(input).returning();
      return c.json(toDocument(created), 201);
    },
  );

  app.put(
    "/api/admin/documents/:id",
    requirePermission("documents.manage"),
    validateJson(documentUpdateSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.documents.findFirst({
        where: eq(documents.id, id),
      });

      if (!existing) return c.json({ error: "Document not found" }, 404);

      const categoryId = input.categoryId ?? existing.categoryId;
      const slug = input.slug ?? existing.slug;

      if (categoryId !== existing.categoryId || slug !== existing.slug) {
        const conflict = await db.query.documents.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.categoryId, categoryId), eq(table.slug, slug)),
        });

        if (conflict) {
          return c.json({ error: "Slug already exists in the category" }, 409);
        }
      }

      const [updated] = await db
        .update(documents)
        .set(input)
        .where(eq(documents.id, id))
        .returning();

      return c.json(toDocument(updated));
    },
  );

  app.delete(
    "/api/admin/documents/:id",
    requirePermission("documents.manage"),
    async (c) => {
      const id = c.req.param("id");

      const deleted = await db
        .delete(documents)
        .where(eq(documents.id, id))
        .returning({ id: documents.id });

      if (deleted.length === 0) {
        return c.json({ error: "Document not found" }, 404);
      }

      return c.body(null, 204);
    },
  );

  app.get(
    "/api/admin/document-categories",
    requirePermission("documents.view"),
    async (c) => {
      const [categories, rows] = await Promise.all([
        db
          .select()
          .from(documentCategories)
          .orderBy(asc(documentCategories.sortOrder), asc(documentCategories.title)),
        db.select().from(documents),
      ]);

      return c.json(
        categories.map((category) =>
          toCategory(
            category,
            rows
              .filter((document) => document.categoryId === category.id)
              .map(toDocument),
          ),
        ),
      );
    },
  );

  app.post(
    "/api/admin/document-categories",
    requirePermission("documents.manage"),
    validateJson(categoryInputSchema),
    async (c) => {
      const input = c.req.valid("json");
      const id = input.id ?? input.slug;

      const conflict = await db.query.documentCategories.findFirst({
        where: (table, { or, eq }) =>
          or(eq(table.id, id), eq(table.slug, input.slug)),
      });

      if (conflict) {
        return c.json({ error: "Category slug already exists" }, 409);
      }

      const [created] = await db
        .insert(documentCategories)
        .values({
          id,
          slug: input.slug,
          title: input.title,
          sortOrder: input.sortOrder,
        })
        .returning();

      return c.json(toCategory(created, []), 201);
    },
  );

  app.put(
    "/api/admin/document-categories/:id",
    requirePermission("documents.manage"),
    validateJson(categoryUpdateSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");

      const [updated] = await db
        .update(documentCategories)
        .set(input)
        .where(eq(documentCategories.id, id))
        .returning();

      if (!updated) return c.json({ error: "Category not found" }, 404);

      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.categoryId, id));

      return c.json(toCategory(updated, rows.map(toDocument)));
    },
  );

  app.delete(
    "/api/admin/document-categories/:id",
    requirePermission("documents.manage"),
    async (c) => {
      const id = c.req.param("id");

      const deleted = await db
        .delete(documentCategories)
        .where(eq(documentCategories.id, id))
        .returning({ id: documentCategories.id });

      if (deleted.length === 0) {
        return c.json({ error: "Category not found" }, 404);
      }

      return c.body(null, 204);
    },
  );
};
