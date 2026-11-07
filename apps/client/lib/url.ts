/** The site's public address (PNW_PUBLIC_URL), for absolute URLs in the sitemap, robots.txt and structured data. */
export const SITE_URL = (process.env.PNW_PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '')

export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`)
