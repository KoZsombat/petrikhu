import { and, count, desc, eq, ilike, like, notLike } from "drizzle-orm";
import type { Hono } from "hono";
import { db } from "../db";
import { media } from "../db/schema";
import { env } from "../env";
import { requirePermission } from "../middleware/auth";

const MAX_BYTES = 25 * 1024 * 1024;
const MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/avif": true,
  "image/gif": true,
  "image/bmp": true,
  "application/pdf": true,
  "application/msword": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/vnd.ms-excel": true,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/vnd.ms-powerpoint": true,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
  "text/plain": true,
  "text/csv": true,
  "application/zip": true,
};

const publicUrl = (id: string) =>
  `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}/api/media/${id}`;

export const registerMediaRoutes = (app: Hono) => {
  app.get("/api/media/:id", async (c) => {
    const id = c.req.param("id");
    const row = await db.query.media.findFirst({ where: eq(media.id, id) });

    if (!row) {
      return c.json({ error: "Image not found" }, 404);
    }

    return new Response(new Uint8Array(row.data), {
      headers: {
        "content-type": row.mime,
        "content-length": String(row.size),
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${row.id}"`,
      },
    });
  });

  app.get(
    "/api/admin/media",
    requirePermission("media.view"),
    async (c) => {
      const kind = c.req.query("kind") === "document" ? "document" : "image";
      const limit = Math.min(120, Math.max(1, Number(c.req.query("limit")) || 60));
      const offset = Math.max(0, Number(c.req.query("offset")) || 0);
      const q = c.req.query("q")?.trim();

      const filters = and(
        kind === "document"
          ? notLike(media.mime, "image/%")
          : like(media.mime, "image/%"),
        q ? ilike(media.name, `%${q}%`) : undefined,
      );

      const [rows, totalRows] = await Promise.all([
        db
        .select({
          id: media.id,
          name: media.name,
          mime: media.mime,
          size: media.size,
          createdAt: media.createdAt,
        })
          .from(media)
          .where(filters)
          .orderBy(desc(media.createdAt), desc(media.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(media).where(filters),
      ]);

      c.header("x-total-count", String(totalRows[0]?.total ?? 0));

      return c.json(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          mime: row.mime,
          size: row.size,
          url: publicUrl(row.id),
          createdAt: row.createdAt.toISOString(),
        })),
      );
    },
  );

  app.post(
    "/api/admin/media",
    requirePermission("media.upload"),
    async (c) => {
      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file instanceof File)) {
        return c.json({ error: "Missing file" }, 400);
      }

      if (!MIME_TYPES[file.type]) {
        return c.json(
          { error: "Only images and common document types are allowed" },
          415,
        );
      }

      if (file.size > MAX_BYTES) {
        return c.json({ error: "File is larger than 25 MB" }, 413);
      }

      const [created] = await db
        .insert(media)
        .values({
          name: file.name || "image",
          mime: file.type,
          size: file.size,
          data: Buffer.from(await file.arrayBuffer()),
        })
        .returning();

      return c.json(
        {
          id: created.id,
          name: created.name,
          mime: created.mime,
          size: created.size,
          url: publicUrl(created.id),
          createdAt: created.createdAt.toISOString(),
        },
        201,
      );
    },
  );

  app.delete(
    "/api/admin/media/:id",
    requirePermission("media.delete"),
    async (c) => {
      const id = c.req.param("id");
      const deleted = await db
        .delete(media)
        .where(eq(media.id, id))
        .returning({ id: media.id });

      if (deleted.length === 0) {
        return c.json({ error: "Image not found" }, 404);
      }

      return c.body(null, 204);
    },
  );
};
