import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "../env";
import { db } from "./index";
import { documents, media, posts, teachers } from "./schema";

const LEGACY_BASE = (
  process.env.LEGACY_MEDIA_BASE_URL ?? "https://petrik.hu"
).replace(/\/+$/, "");
const CONCURRENCY = 6;
const MAX_BYTES = 80 * 1024 * 1024;

const LEGACY_URL =
  /(?:https?:)?\/\/(?:www\.)?petrik\.hu\/wp-content\/uploads\/[^\s"'<>)]*|\/media\/wp-content\/uploads\/[^\s"'<>)]*|\/wp-content\/uploads\/[^\s"'<>)]*/g;

/** Normalise an old-site media reference to the `/wp-content/uploads/...` path. */
function legacyPath(value: string): string | null {
  let raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("//")) raw = `https:${raw}`;

  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname !== "petrik.hu" && url.hostname !== "www.petrik.hu") {
        return null;
      }
      path = url.pathname;
    } catch {
      return null;
    }
  }

  if (path.startsWith("/media/wp-content/")) path = path.slice("/media".length);
  if (!path.startsWith("/wp-content/uploads/")) return null;
  return path;
}

/** Accent/case-insensitive name key for matching the old teacher page to our rows. */
function nameKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/**
 * The old teacher page contains a portrait for every teacher (real photo or the school's
 * male/female placeholder). Copy those URLs onto rows that have no photo yet; seedMedia then
 * imports the bytes and rewrites the URLs.
 */
export async function seedTeacherPhotos() {
  let html = "";
  try {
    const response = await fetch(`${LEGACY_BASE}/tanari-kar/`, {
      headers: { "user-agent": "petrikhu-seed/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {
    console.warn(
      `Teacher photos unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const byName = new Map<string, string>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const alt = /\balt="([^"]*)"/i.exec(match[0])?.[1]?.trim();
    const src = /\bsrc="([^"]+)"/i.exec(match[0])?.[1];
    if (alt && src) byName.set(nameKey(alt), src);
  }

  const rows = await db.select().from(teachers);
  const updates = rows.flatMap((teacher) => {
    if (teacher.photo) return [];
    const photo = byName.get(nameKey(teacher.name));
    return photo ? [{ id: teacher.id, photo }] : [];
  });

  for (let index = 0; index < updates.length; index += 100) {
    const payload = JSON.stringify(updates.slice(index, index + 100));
    await db.execute(sql`
      UPDATE teachers AS t
      SET photo = v.photo
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, photo text)
      WHERE t.id = v.id
    `);
  }

  console.log(`Teacher photos set from the old site: ${updates.length}.`);
}

const idFor = (path: string) =>
  `legacy-${createHash("sha1").update(path).digest("hex").slice(0, 32)}`;

const publicUrl = (id: string) =>
  `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}/api/media/${id}`;

const rewrite = (
  value: string | null,
  mapping: Map<string, string>,
): string | null => {
  if (!value) return value;
  return value.replace(LEGACY_URL, (match) => {
    const path = legacyPath(match);
    return path ? (mapping.get(path) ?? match) : match;
  });
};

function collectPaths(input: {
  posts: (typeof posts.$inferSelect)[];
  documents: (typeof documents.$inferSelect)[];
  teachers: (typeof teachers.$inferSelect)[];
}): string[] {
  const paths = new Set<string>();
  const collect = (value: string | null) => {
    if (!value) return;
    for (const match of value.matchAll(LEGACY_URL)) {
      const path = legacyPath(match[0]);
      if (path) paths.add(path);
    }
  };

  for (const post of input.posts) {
    collect(post.image);
    collect(post.content);
    collect(post.contentHtml);
  }
  for (const document of input.documents) collect(document.file);
  for (const teacher of input.teachers) collect(teacher.photo);

  return [...paths].sort();
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function download(path: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${LEGACY_BASE}${encodeURI(path)}`, {
        headers: { "user-agent": "petrikhu-seed/1.0" },
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const mime = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      if (!mime || mime === "text/html") {
        throw new Error(`unexpected content type ${mime || "none"}`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0) throw new Error("empty response");
      if (data.length > MAX_BYTES) throw new Error(`too large (${data.length})`);

      let name = "asset";
      try {
        name = decodeURIComponent(path.split("/").pop() ?? "asset").slice(0, 250);
      } catch {
        name = (path.split("/").pop() ?? "asset").slice(0, 250);
      }

      return { name, mime, data };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await Bun.sleep(400 * attempt);
    }
  }

  throw lastError;
}

/**
 * Import the old WordPress uploads referenced by posts/documents/teachers into `media` and rewrite
 * every reference to the public media endpoint. Existing rows are reused, so this is idempotent.
 */
export async function seedMedia() {
  const [postRows, documentRows, teacherRows] = await Promise.all([
    db.select().from(posts),
    db.select().from(documents),
    db.select().from(teachers),
  ]);

  const paths = collectPaths({
    posts: postRows,
    documents: documentRows,
    teachers: teacherRows,
  });

  if (paths.length === 0) {
    console.log("Legacy media already imported.");
    return;
  }

  const existing = new Set(
    (await db.select({ id: media.id }).from(media)).map((row) => row.id),
  );

  const mapping = new Map<string, string>();
  let completed = 0;
  let imported = 0;
  let failed = 0;

  await mapLimit(paths, CONCURRENCY, async (path) => {
    const id = idFor(path);
    const url = publicUrl(id);

    if (existing.has(id)) {
      mapping.set(path, url);
      completed += 1;
      return;
    }

    try {
      const asset = await download(path);

      await db
        .insert(media)
        .values({
          id,
          name: asset.name,
          mime: asset.mime,
          size: asset.data.length,
          data: asset.data,
        })
        .onConflictDoNothing();

      existing.add(id);
      mapping.set(path, url);
      imported += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `Legacy media skipped ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      completed += 1;
      if (completed % 50 === 0 || completed === paths.length) {
        console.log(
          `Legacy media ${completed}/${paths.length} (${imported} imported, ${failed} failed)`,
        );
      }
    }
  });

  const postUpdates = postRows.flatMap((post) => {
    const image = rewrite(post.image, mapping);
    const content = rewrite(post.content, mapping) ?? post.content;
    const contentHtml = rewrite(post.contentHtml, mapping);

    if (
      image === post.image &&
      content === post.content &&
      contentHtml === post.contentHtml
    ) {
      return [];
    }

    return [{ id: post.id, image, content, content_html: contentHtml }];
  });

  for (let index = 0; index < postUpdates.length; index += 100) {
    const payload = JSON.stringify(postUpdates.slice(index, index + 100));
    await db.execute(sql`
      UPDATE posts AS p
      SET image = v.image, content = v.content, "contentHtml" = v.content_html
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, image text, content text, content_html text)
      WHERE p.id = v.id
    `);
  }

  const documentUpdates = documentRows.flatMap((document) => {
    const file = rewrite(document.file, mapping);
    return file === document.file ? [] : [{ id: document.id, file }];
  });

  for (let index = 0; index < documentUpdates.length; index += 100) {
    const payload = JSON.stringify(documentUpdates.slice(index, index + 100));
    await db.execute(sql`
      UPDATE documents AS d
      SET file = v.file
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, file text)
      WHERE d.id = v.id
    `);
  }

  const teacherUpdates = teacherRows.flatMap((teacher) => {
    const photo = rewrite(teacher.photo, mapping);
    return photo === teacher.photo ? [] : [{ id: teacher.id, photo }];
  });

  for (let index = 0; index < teacherUpdates.length; index += 100) {
    const payload = JSON.stringify(teacherUpdates.slice(index, index + 100));
    await db.execute(sql`
      UPDATE teachers AS t
      SET photo = v.photo
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, photo text)
      WHERE t.id = v.id
    `);
  }

  const changedPosts = postUpdates.length;

  console.log(
    `Legacy media ready: ${paths.length} references, ${imported} new files, ${failed} failed, ${changedPosts} posts rewritten.`,
  );
}

