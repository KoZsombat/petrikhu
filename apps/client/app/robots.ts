import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/url'

// Reads PNW_PUBLIC_URL at run time (the Docker build does not know it).
export const dynamic = 'force-dynamic'

/** Everything public may be crawled; the API, the admin, previews, search results and /revalidate may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/elonezet/', '/kereses', '/revalidate'] },
    sitemap: absolute('/sitemap.xml'),
  }
}
