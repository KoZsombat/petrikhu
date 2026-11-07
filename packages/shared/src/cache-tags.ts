/**
 * Cache tags of the public site's data cache (apps/client/lib/api.ts tags its reads, the API revalidates them
 * after a change through the site's /revalidate endpoint). One place, so both sides agree.
 */
export const TAG = {
  /** Every public read: revalidated when anything could be affected (e.g. a media delete). */
  all: 'public',
  /** Menu, document library and translation pairs (GET /api/public/site/:locale). */
  site: 'site',
  /** Anything that lists or links pages (translations, alternates, sitemap, resolve). */
  pages: 'pages',
  /** Post lists, the sitemap's posts, old news URLs. */
  posts: 'posts',
  redirects: 'redirects',
  sitemap: 'sitemap',
  page: (locale: string, slug: string) => `page:${locale}:${slug}`,
  post: (slug: string) => `post:${slug}`,
} as const
