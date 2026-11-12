import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { posts } from "../db/schema";
import { permissionsForUser, requirePermission, roleOf } from "../middleware/auth";
import {
  postInputSchema,
  postListQuerySchema,
  postReviewSchema,
  postUpdateSchema,
} from "../types/postTypes";
import { validateJson, validateQuery } from "../validation";

const toPostSummary = (post: typeof posts.$inferSelect) => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  category: post.category,
  image: post.image,
  gallery: post.gallery,
  published: post.published,
  status: post.status,
  reviewNote: post.reviewNote,
  publishedAt: post.createdAt.toISOString(),
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

const toPost = (post: typeof posts.$inferSelect) => ({
  ...post,
  publishedAt: post.createdAt.toISOString(),
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

export const registerPostRoutes = (app: Hono) => {
  app.get("/api/posts", validateQuery(postListQuerySchema), async (c) => {
    const { limit, offset, category, q } = c.req.valid("query");

    const where = and(
      eq(posts.status, "published"),
      category ? eq(posts.category, category) : undefined,
      q ? or(ilike(posts.title, `%${q}%`), ilike(posts.content, `%${q}%`)) : undefined,
    );

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(posts)
        .where(where)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(posts).where(where),
    ]);

    return c.json({
      posts: rows.map(toPostSummary),
      total: totalRows[0]?.total ?? 0,
    });
  });

  app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.slug, slug), eq(posts.status, "published")),
    });

    if (!post) return c.json({ error: "Post not found" }, 404);

    return c.json(toPost(post));
  });

  app.get("/api/admin/posts", requirePermission("posts.view"), async (c) => {
    const rows = await db.select().from(posts).orderBy(desc(posts.createdAt));
    return c.json(rows.map(toPostSummary));
  });

  app.post(
    "/api/admin/posts",
    requirePermission("posts.create"),
    validateJson(postInputSchema),
    async (c) => {
      const input = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.slug, input.slug),
      });

      if (existing) return c.json({ error: "Slug already exists" }, 409);

      const [created] = await db
        .insert(posts)
        .values({ ...input, published: false, status: "draft", reviewNote: null })
        .returning();

      return c.json(toPost(created), 201);
    },
  );

  app.get(
    "/api/admin/posts/:id",
    requirePermission("posts.view"),
    async (c) => {
      const id = c.req.param("id");
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });

      if (!post) return c.json({ error: "Post not found" }, 404);

      return c.json(toPost(post));
    },
  );

  app.put(
    "/api/admin/posts/:id",
    requirePermission("posts.update"),
    validateJson(postUpdateSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });

      if (!existing) return c.json({ error: "Post not found" }, 404);

      if (input.published === true) {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        const actor = session
          ? await permissionsForUser(session.user.id, roleOf(session.user))
          : new Set<string>();

        if (!actor.has("posts.publish")) {
          return c.json({ error: "Forbidden: missing posts.publish" }, 403);
        }
      }

      if (input.slug && input.slug !== existing.slug) {
        const conflict = await db.query.posts.findFirst({
          where: eq(posts.slug, input.slug),
        });

        if (conflict) return c.json({ error: "Slug already exists" }, 409);
      }

      const values =
        input.content !== undefined
          ? { ...input, contentHtml: input.contentHtml ?? null }
          : input;

      const [updated] = await db
        .update(posts)
        .set(values)
        .where(eq(posts.id, id))
        .returning();

      return c.json(toPost(updated));
    },
  );

  app.delete(
    "/api/admin/posts/:id",
    requirePermission("posts.delete"),
    async (c) => {
      const id = c.req.param("id");

      const deleted = await db
        .delete(posts)
        .where(eq(posts.id, id))
        .returning({ id: posts.id });

      if (deleted.length === 0) return c.json({ error: "Post not found" }, 404);

      return c.body(null, 204);
    },
  );

  app.post(
    "/api/admin/posts/:id/submit",
    requirePermission("posts.submit"),
    async (c) => {
      const id = c.req.param("id");

      const [updated] = await db
        .update(posts)
        .set({ status: "pending", reviewNote: null })
        .where(eq(posts.id, id))
        .returning();

      if (!updated) return c.json({ error: "Post not found" }, 404);

      return c.json(toPost(updated));
    },
  );

  app.post(
    "/api/admin/posts/:id/review",
    requirePermission("posts.review"),
    validateJson(postReviewSchema),
    async (c) => {
      const id = c.req.param("id");
      const { decision, note } = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });

      if (!existing) return c.json({ error: "Post not found" }, 404);

      if (existing.status !== "pending") {
        return c.json({ error: "Post is not pending review" }, 409);
      }

      const [updated] = await db
        .update(posts)
        .set(
          decision === "approve"
            ? { status: "published", published: true, reviewNote: null }
            : { status: "draft", published: false, reviewNote: note ?? null },
        )
        .where(eq(posts.id, id))
        .returning();

      return c.json(toPost(updated));
    },
  );
};
