import type { APIRoute } from "astro";
import { SITE_URL } from "../lib/seo";

export const prerender = false;
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /kereses
Disallow: /404

Sitemap: ${SITE_URL}/sitemap.xml
`,
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
