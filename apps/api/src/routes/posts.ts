import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { postAuditLog, posts, user } from "../db/schema";
import { logPostEvent } from "../lib/post-audit";
import {
  notifyApproved,
  notifyRejected,
  notifySubmitted,
} from "../lib/notify";
import { sanitizePostHtml } from "../lib/sanitize";
import { permissionsForUser, roleOf } from "../middleware/auth";
import type { Permission } from "../permissions";
import {
  adminPostListQuerySchema,
  postInputSchema,
  postListQuerySchema,
  postReviewSchema,
  postUpdateSchema,
  type PostStatus,
} from "../types/postTypes";
import { validateJson, validateQuery } from "../validation";

type Actor = {
  userId: string;
  name: string;
  permissions: Set<Permission>;
};

type PostRow = typeof posts.$inferSelect;

const iso = (value: Date | null) => value?.toISOString() ?? null;

/**
 * Mirrors the WordPress plugin's `can_edit_workflow_post`: a reviewer may touch a post only while
 * it sits in the approval queue; an author only their own draft or returned post. Submitting locks
 * the post for its author — that lock is the whole point of the workflow.
 */
const canEdit = (actor: Actor, post: PostRow): boolean =>
  actor.permissions.has("posts.review")
    ? post.status === "pending"
    : actor.permissions.has("posts.update") &&
      post.authorId === actor.userId &&
      (post.status === "draft" || post.status === "revision");

const actionsFor = (actor: Actor, post: PostRow) => ({
  edit: canEdit(actor, post),
  submit:
    actor.permissions.has("posts.submit") &&
    post.authorId === actor.userId &&
    (post.status === "draft" || post.status === "revision"),
  review: actor.permissions.has("posts.review") && post.status === "pending",
  delete:
    (actor.permissions.has("posts.publish") && post.status === "published") ||
    (actor.permissions.has("posts.delete") &&
      post.authorId === actor.userId &&
      (post.status === "draft" || post.status === "revision")),
});

const toPostSummary = (
  post: PostRow,
  actor: Actor,
  authorName: string | null,
) => ({
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
  authorId: post.authorId,
  authorName,
  submittedAt: iso(post.submittedAt),
  reviewedAt: iso(post.reviewedAt),
  publishedAt: iso(post.publishedAt),
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
  actions: actionsFor(actor, post),
});

const toPost = (
  post: PostRow,
  actor: Actor,
  authorName: string | null,
  reviewerName: string | null = null,
  history: {
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }[] = [],
) => ({
  ...toPostSummary(post, actor, authorName),
  content: post.content,
  contentHtml: post.contentHtml,
  reviewerName,
  history,
});

/** Session + effective permissions. Every mutating route re-derives this; never trust the body. */
const actorFor = async (request: Request): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const role = roleOf(session.user);
  return {
    userId: session.user.id,
    name: session.user.name,
    permissions: await permissionsForUser(session.user.id, role),
  };
};

const authorOf = async (post: PostRow) => {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, post.authorId))
    .limit(1);
  return row ?? null;
};

const readHistory = async (postId: string) => {
  const rows = await db
    .select({
      id: postAuditLog.id,
      action: postAuditLog.action,
      fromStatus: postAuditLog.fromStatus,
      toStatus: postAuditLog.toStatus,
      note: postAuditLog.note,
      actorName: user.name,
      createdAt: postAuditLog.createdAt,
    })
    .from(postAuditLog)
    .leftJoin(user, eq(user.id, postAuditLog.actorId))
    .where(eq(postAuditLog.postId, postId))
    .orderBy(asc(postAuditLog.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
};

const missing = (permission: Permission) => ({
  error: `Forbidden: missing ${permission}`,
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
      posts: rows.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        category: post.category,
        image: post.image,
        gallery: post.gallery,
        publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })),
      total: totalRows[0]?.total ?? 0,
    });
  });

  app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.slug, slug), eq(posts.status, "published")),
    });

    if (!post) return c.json({ error: "Post not found" }, 404);

    return c.json({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      contentHtml: post.contentHtml,
      category: post.category,
      image: post.image,
      gallery: post.gallery,
      publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });
  });

  /* ---------------------------------------------------------------- admin */

  app.get(
    "/api/admin/posts",
    validateQuery(adminPostListQuerySchema),
    async (c) => {
      const actor = await actorFor(c.req.raw);
      if (!actor) return c.json({ error: "Unauthorized" }, 401);
      if (!actor.permissions.has("posts.view")) {
        return c.json(missing("posts.view"), 403);
      }

      const { status } = c.req.valid("query");
      const canReview = actor.permissions.has("posts.review");

      const where = and(
        canReview ? undefined : eq(posts.authorId, actor.userId),
        status ? eq(posts.status, status) : undefined,
      );

      const rows = await db
        .select({ post: posts, authorName: user.name })
        .from(posts)
        .leftJoin(user, eq(user.id, posts.authorId))
        .where(where)
        .orderBy(desc(posts.updatedAt));

      return c.json(
        rows.map((row) => toPostSummary(row.post, actor, row.authorName)),
      );
    },
  );

  app.get("/api/admin/posts/:id", async (c) => {
    const actor = await actorFor(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    if (!actor.permissions.has("posts.view")) {
      return c.json(missing("posts.view"), 403);
    }

    const id = c.req.param("id");
    const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    if (!post) return c.json({ error: "Post not found" }, 404);

    // An author never sees somebody else's post, not even through a guessed id.
    if (!actor.permissions.has("posts.review") && post.authorId !== actor.userId) {
      return c.json({ error: "Post not found" }, 404);
    }

    const [author, reviewer, history] = await Promise.all([
      authorOf(post),
      post.reviewerId
        ? db
            .select({ name: user.name })
            .from(user)
            .where(eq(user.id, post.reviewerId))
            .limit(1)
            .then((rows) => rows[0]?.name ?? null)
        : Promise.resolve(null),
      readHistory(post.id),
    ]);

    return c.json(toPost(post, actor, author?.name ?? null, reviewer, history));
  });

  app.post(
    "/api/admin/posts",
    validateJson(postInputSchema),
    async (c) => {
      const actor = await actorFor(c.req.raw);
      if (!actor) return c.json({ error: "Unauthorized" }, 401);
      if (!actor.permissions.has("posts.create")) {
        return c.json(missing("posts.create"), 403);
      }

      const input = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.slug, input.slug),
      });
      if (existing) return c.json({ error: "Slug already exists" }, 409);

      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(posts)
          .values({
            ...input,
            contentHtml: sanitizePostHtml(input.contentHtml),
            authorId: actor.userId,
            published: false,
            status: "draft",
            reviewNote: null,
          })
          .returning();

        if (row) {
          await logPostEvent(tx, {
            postId: row.id,
            actorId: actor.userId,
            action: "created",
            toStatus: "draft",
          });
        }
        return row;
      });

      return c.json(toPost(created, actor, actor.name), 201);
    },
  );

  app.put(
    "/api/admin/posts/:id",
    validateJson(postUpdateSchema),
    async (c) => {
      const actor = await actorFor(c.req.raw);
      if (!actor) return c.json({ error: "Unauthorized" }, 401);

      const id = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });
      if (!existing) return c.json({ error: "Post not found" }, 404);

      if (!canEdit(actor, existing)) {
        return c.json(
          {
            error:
              existing.authorId !== actor.userId &&
              !actor.permissions.has("posts.review")
                ? "Forbidden: not your post"
                : "Forbidden: this post is not editable in its current status",
          },
          403,
        );
      }

      if (input.slug && input.slug !== existing.slug) {
        const conflict = await db.query.posts.findFirst({
          where: eq(posts.slug, input.slug),
        });
        if (conflict) return c.json({ error: "Slug already exists" }, 409);
      }

      // A plain-text edit (content without contentHtml) clears the stored HTML.
      const contentHtml =
        input.content !== undefined
          ? sanitizePostHtml(input.contentHtml ?? null)
          : input.contentHtml === undefined
            ? undefined
            : sanitizePostHtml(input.contentHtml);
      const values =
        contentHtml === undefined ? input : { ...input, contentHtml };

      const reviewerEditing = existing.authorId !== actor.userId;

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(posts)
          .set(values)
          .where(eq(posts.id, id))
          .returning();

        if (row) {
          await logPostEvent(tx, {
            postId: row.id,
            actorId: actor.userId,
            action: reviewerEditing ? "reviewer_edited" : "updated",
            fromStatus: existing.status,
            toStatus: row.status,
          });
        }
        return row;
      });

      const author = await authorOf(updated);
      return c.json(toPost(updated, actor, author?.name ?? null));
    },
  );

  app.delete("/api/admin/posts/:id", async (c) => {
    const actor = await actorFor(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
    });
    if (!existing) return c.json({ error: "Post not found" }, 404);

    if (!actionsFor(actor, existing).delete) {
      return c.json(
        { error: "Forbidden: this post cannot be deleted in its current status" },
        403,
      );
    }

    await db.transaction(async (tx) => {
      // Log first: the FK nulls `postId` when the row disappears, keeping the trail identifiable.
      await logPostEvent(tx, {
        postId: id,
        actorId: actor.userId,
        action: "deleted",
        fromStatus: existing.status,
        toStatus: null,
        note: existing.title,
      });
      await tx.delete(posts).where(eq(posts.id, id));
    });

    return c.body(null, 204);
  });

  app.post("/api/admin/posts/:id/submit", async (c) => {
    const actor = await actorFor(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    if (!actor.permissions.has("posts.submit")) {
      return c.json(missing("posts.submit"), 403);
    }

    const id = c.req.param("id");
    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
    });
    if (!existing) return c.json({ error: "Post not found" }, 404);

    if (existing.authorId !== actor.userId) {
      return c.json({ error: "Forbidden: not your post" }, 403);
    }

    if (existing.status !== "draft" && existing.status !== "revision") {
      return c.json(
        { error: "Only a draft or a returned post can be submitted" },
        409,
      );
    }

    if (
      !existing.title.trim() ||
      !existing.content.trim() ||
      !existing.category.trim()
    ) {
      return c.json(
        { error: "Title, content and category are required before submitting" },
        400,
      );
    }

    const submitted = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(posts)
        .set({
          status: "pending",
          submittedAt: new Date(),
          reviewNote: null,
          reviewerId: null,
          reviewedAt: null,
          published: false,
          publishedAt: null,
        })
        .where(eq(posts.id, id))
        .returning();

      if (row) {
        await logPostEvent(tx, {
          postId: row.id,
          actorId: actor.userId,
          action: "submitted",
          fromStatus: existing.status,
          toStatus: "pending",
        });
      }
      return row;
    });

    void notifySubmitted({
      postId: submitted.id,
      title: submitted.title,
      authorName: actor.name,
    }).catch((cause) => console.error("[mail] submit notification failed", cause));

    const author = await authorOf(submitted);
    return c.json(toPost(submitted, actor, author?.name ?? null));
  });

  app.post(
    "/api/admin/posts/:id/review",
    validateJson(postReviewSchema),
    async (c) => {
      const actor = await actorFor(c.req.raw);
      if (!actor) return c.json({ error: "Unauthorized" }, 401);
      if (!actor.permissions.has("posts.review")) {
        return c.json(missing("posts.review"), 403);
      }

      const id = c.req.param("id");
      const { decision, note } = c.req.valid("json");

      const existing = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });
      if (!existing) return c.json({ error: "Post not found" }, 404);

      if (existing.status !== "pending") {
        return c.json({ error: "Post is not pending review" }, 409);
      }

      // Approving publishes the post: it must not become a way around `posts.publish`.
      if (decision === "approve" && !actor.permissions.has("posts.publish")) {
        return c.json(missing("posts.publish"), 403);
      }

      const target: PostStatus = decision === "approve" ? "published" : "revision";
      const reviewedAt = new Date();

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(posts)
          .set({
            status: target,
            published: decision === "approve",
            publishedAt: decision === "approve" ? reviewedAt : null,
            reviewNote: decision === "approve" ? null : (note ?? null),
            reviewerId: actor.userId,
            reviewedAt,
          })
          .where(eq(posts.id, id))
          .returning();

        if (row) {
          await logPostEvent(tx, {
            postId: row.id,
            actorId: actor.userId,
            action: decision === "approve" ? "approved" : "rejected",
            fromStatus: "pending",
            toStatus: target,
            note: decision === "approve" ? null : note,
          });
        }
        return row;
      });

      const author = await authorOf(updated);

      if (decision === "approve") {
        void notifyApproved({
          to: author?.email ?? null,
          title: updated.title,
          slug: updated.slug,
        }).catch((cause) => console.error("[mail] approve notification failed", cause));
      } else {
        void notifyRejected({
          to: author?.email ?? null,
          title: updated.title,
          note: note ?? "",
        }).catch((cause) => console.error("[mail] reject notification failed", cause));
      }

      return c.json(toPost(updated, actor, author?.name ?? null, actor.name));
    },
  );
};
