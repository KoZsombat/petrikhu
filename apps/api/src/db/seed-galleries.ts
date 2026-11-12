import { sql } from "drizzle-orm";
import { db } from "./index";
import { posts } from "./schema";

/**
 * The old WordPress editor wrapped each gallery in an outer <figure> containing a run of inner
 * <figure><img></figure> items. Convert those runs to the same [data-gallery] node the new editor
 * inserts, so existing posts render as a grid and can be edited as one gallery block.
 */
const GALLERY = /<figure>\s*((?:<figure>[\s\S]*?<\/figure>\s*)+)<\/figure>/gi;

function convert(html: string): string {
  return html.replace(GALLERY, (match, inner: string) => {
    const sources = [...inner.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
      .map((entry) => entry[1])
      .filter((src) => !src.startsWith("data:"));

    if (sources.length < 2) return match;

    const data = JSON.stringify(sources).replace(/'/g, "&#39;");
    const images = sources
      .map((src) => `<img src="${src}" alt="" loading="lazy">`)
      .join("");

    return `<div data-gallery="" data-images='${data}' class="post-gallery">${images}</div>`;
  });
}

export async function seedLegacyGalleries() {
  const rows = await db
    .select({ id: posts.id, contentHtml: posts.contentHtml })
    .from(posts);

  const updates = rows.flatMap((row) => {
    if (!row.contentHtml) return [];
    const contentHtml = convert(row.contentHtml);
    if (contentHtml === row.contentHtml) return [];
    return [{ id: row.id, content_html: contentHtml }];
  });

  for (let index = 0; index < updates.length; index += 100) {
    const batch = updates.slice(index, index + 100);
    const payload = JSON.stringify(batch);

    await db.execute(sql`
      UPDATE posts AS p
      SET "contentHtml" = v.content_html
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, content_html text)
      WHERE p.id = v.id
    `);
  }

  console.log(`Legacy galleries adapted: ${updates.length} posts.`);
}
