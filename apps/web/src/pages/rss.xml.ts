import type { APIRoute } from "astro";
import { getPosts } from "../lib/api";
import { absoluteUrl, SITE_NAME, SITE_URL } from "../lib/seo";

export const prerender = false;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const GET: APIRoute = async () => {
  let posts: Awaited<ReturnType<typeof getPosts>>["posts"] = [];

  try {
    posts = (await getPosts({ limit: 50 })).posts;
  } catch (error) {
    console.error("RSS: posts unavailable", error);
  }

  const items = posts
    .map((post) => {
      const link = absoluteUrl(`/hirek/${post.slug}`);
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.excerpt || post.title)}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} – Hírek</title>
    <link>${SITE_URL}/hirek</link>
    <description>${escapeXml(SITE_NAME)} hírei és közleményei.</description>
    <language>hu-HU</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=1800",
    },
  });
};
