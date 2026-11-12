import type { APIRoute } from "astro";
import { getPosts } from "../lib/api";
import { SITE_URL } from "../lib/seo";

export const prerender = false;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const absolute = (path: string) => `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

const staticPaths = () =>
  Object.keys(import.meta.glob("./**/*.astro"))
    .map((file) => file.replace(/^\.\//, "/").replace(/\.astro$/, ""))
    .map((path) => (path.endsWith("/index") ? path.slice(0, -"/index".length) || "/" : path))
    .filter(
      (path) =>
        !path.includes("[") &&
        path !== "/404" &&
        path !== "/kereses" &&
        !path.startsWith("/en/404"),
    );

const urlEntry = (
  loc: string,
  options: { lastmod?: string; changefreq?: string; priority?: string } = {},
) => `  <url>
    <loc>${escapeXml(absolute(loc))}</loc>${
      options.lastmod ? `\n    <lastmod>${options.lastmod}</lastmod>` : ""
    }${options.changefreq ? `\n    <changefreq>${options.changefreq}</changefreq>` : ""}${
      options.priority ? `\n    <priority>${options.priority}</priority>` : ""
    }
  </url>`;

export const GET: APIRoute = async () => {
  const entries = staticPaths().sort().map((path) =>
    urlEntry(path, {
      changefreq: path === "/" || path === "/hirek" ? "daily" : "monthly",
      priority: path === "/" ? "1.0" : path === "/hirek" ? "0.9" : "0.6",
    }),
  );

  try {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const result = await getPosts({ limit: 50, offset });
      total = result.total;

      for (const post of result.posts) {
        entries.push(
          urlEntry(`/hirek/${post.slug}`, {
            lastmod: post.updatedAt.slice(0, 10),
            changefreq: "weekly",
            priority: "0.7",
          }),
        );
      }

      if (result.posts.length === 0) break;
      offset += result.posts.length;
    }
  } catch (error) {
    console.error("Sitemap: posts unavailable", error);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
