import { asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { postCategories, posts } from "../db/schema";
import { requirePermission } from "../middleware/auth";
import {
  postCategoryInputSchema,
  postCategoryUpdateSchema,
} from "../types/categoryTypes";
import { validateJson } from "../validation";

const toCategory = (category: typeof postCategories.$inferSelect) => ({
  id: category.id,
  slug: category.slug,
  title: category.title,
  sortOrder: category.sortOrder,
});

export const registerPostCategoryRoutes = (app: Hono) => {
  app.get("/api/post-categories", async (c) => {
    const rows = await db
      .select()
      .from(postCategories)
      .orderBy(asc(postCategories.sortOrder), asc(postCategories.title));

    return c.json(rows.map(toCategory));
  });

  app.post(
    "/api/admin/post-categories",
    requirePermission("posts.update"),
    validateJson(postCategoryInputSchema),
    async (c) => {
      const input = c.req.valid("json");

      const existing = await db.query.postCategories.findFirst({
        where: eq(postCategories.slug, input.slug),
      });
      if (existing) return c.json({ error: "Slug already exists" }, 409);

      const [created] = await db
        .insert(postCategories)
        .values({
          id: input.slug,
          slug: input.slug,
          title: input.title,
          sortOrder: input.sortOrder,
        })
        .returning();

      return c.json(toCategory(created), 201);
    },
  );

  app.put(
    "/api/admin/post-categories/:id",
    requirePermission("posts.update"),
    validateJson(postCategoryUpdateSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.postCategories.findFirst({
        where: eq(postCategories.id, id),
      });
      if (!existing) return c.json({ error: "Category not found" }, 404);

      const title = input.title ?? existing.title;

      if (input.title && input.title !== existing.title) {
        await db.transaction(async (tx) => {
          await tx
            .update(posts)
            .set({ category: title })
            .where(eq(posts.category, existing.title));
          await tx
            .update(postCategories)
            .set({ title, sortOrder: input.sortOrder ?? existing.sortOrder })
            .where(eq(postCategories.id, id));
        });
      } else {
        await db
          .update(postCategories)
          .set({ sortOrder: input.sortOrder ?? existing.sortOrder })
          .where(eq(postCategories.id, id));
      }

      const row = await db.query.postCategories.findFirst({
        where: eq(postCategories.id, id),
      });

      return c.json(toCategory(row ?? existing));
    },
  );

  app.delete(
    "/api/admin/post-categories/:id",
    requirePermission("posts.update"),
    async (c) => {
      const id = c.req.param("id");

      const existing = await db.query.postCategories.findFirst({
        where: eq(postCategories.id, id),
      });
      if (!existing) return c.json({ error: "Category not found" }, 404);

      const [{ total }] = await db
        .select({ total: count() })
        .from(posts)
        .where(eq(posts.category, existing.title));

      if (total > 0) {
        return c.json({ error: `Category is used by ${total} post(s)` }, 409);
      }

      await db.delete(postCategories).where(eq(postCategories.id, id));
      return c.body(null, 204);
    },
  );
};
