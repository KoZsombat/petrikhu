/**
 * Server-side reads from the Hono API (never from the browser): every page is rendered with its content, so
 * nothing is swapped in after load. Public reads go through Next's data cache, tagged per document, per list and
 * for the site settings (packages/shared/src/cache-tags.ts); the API revalidates the tags after every change
 * (app/revalidate/route.ts), and REVALIDATE_SECONDS is the safety net. Pages are still rendered per request
 * (the CSP nonce), only their data comes from the cache. Previews and searches are never cached.
 */
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { TAG } from '@petrik/shared/cache-tags'
import { PUBLIC_POSTS_MAX_LIMIT, PUBLIC_POSTS_MAX_OFFSET } from '@petrik/shared/schemas'
import type { Locale, PublicPage, PublicPost, PublicPostSummary, PublicSite, PublicSitemap } from '@petrik/shared/schemas'

const API = process.env.PNW_API_URL ?? 'http://localhost:4001'

/** The header the API reads the visitor's IP from (PNW_CLIENT_IP_HEADER, as for the API). */
const CLIENT_IP_HEADER = process.env.PNW_CLIENT_IP_HEADER?.trim().toLowerCase() || ''

export class ApiStatusError extends Error {
  constructor(
    public path: string,
    public status: number,
  ) {
    super(`API ${path}: ${status}`)
  }
}

/** The longest any public data is served from the cache when a revalidation call was missed. */
export const REVALIDATE_SECONDS = 60

/** Cached for REVALIDATE_SECONDS under these tags (plus TAG.all). */
const cached = (...tags: string[]): RequestInit => ({ next: { revalidate: REVALIDATE_SECONDS, tags: [TAG.all, ...tags] } })
const uncached: RequestInit = { cache: 'no-store' }

async function get<T>(path: string, init: RequestInit): Promise<T | null> {
  const res = await fetch(`${API}${path}`, init)
  if (res.status === 404 || res.status === 401) return null
  if (!res.ok) throw new ApiStatusError(path, res.status)
  return (await res.json()) as T
}

export const getSite = cache(async (locale: Locale): Promise<PublicSite> => {
  const site = await get<PublicSite>(`/api/public/site/${locale}`, cached(TAG.site, TAG.pages))
  return site ?? { menu: [], library: { categories: [] }, translations: [] }
})

export const getPage = cache(async (locale: Locale, slug: string): Promise<PublicPage | null> => {
  return (await get<{ page: PublicPage }>(`/api/public/pages/${locale}/${encodeURIComponent(slug)}`, cached(TAG.page(locale, slug), TAG.pages)))?.page ?? null
})

export const getPost = cache(async (slug: string): Promise<PublicPost | null> => {
  return (await get<{ post: PublicPost }>(`/api/public/posts/${encodeURIComponent(slug)}`, cached(TAG.post(slug), TAG.posts)))?.post ?? null
})

/**
 * Published posts. limit and offset are kept within the API's bounds (a block may ask for more). A search passes
 * the visitor's IP header on, so the API's per-IP search limit applies to the visitor, not to this server.
 */
export async function getPosts(query: { limit?: number; offset?: number; category?: string; q?: string }): Promise<{ posts: PublicPostSummary[]; total: number }> {
  const offset = Math.max(0, Math.floor(query.offset ?? 0))
  if (offset > PUBLIC_POSTS_MAX_OFFSET) return { posts: [], total: 0 }
  const params = new URLSearchParams()
  const bounded = { ...query, offset, limit: Math.min(PUBLIC_POSTS_MAX_LIMIT, Math.max(1, Math.floor(query.limit ?? 10))), q: query.q?.trim().slice(0, 200) }
  for (const [key, value] of Object.entries(bounded)) if (value !== undefined && value !== '') params.set(key, String(value))
  // A list is cached; a search (any text) is not, and carries the visitor's IP for the API's search limit.
  const init: RequestInit = bounded.q ? { ...uncached } : cached(TAG.posts)
  if (bounded.q && CLIENT_IP_HEADER) {
    const ip = (await headers()).get(CLIENT_IP_HEADER)
    if (ip) init.headers = { [CLIENT_IP_HEADER]: ip }
  }
  return (await get<{ posts: PublicPostSummary[]; total: number }>(`/api/public/posts?${params}`, init)) ?? { posts: [], total: 0 }
}

/** A preview made in the admin: the visitor's own session cookie is passed on, only its author can open it. */
export async function getPreview(id: string): Promise<{ kind: 'page'; page: PublicPage } | { kind: 'post'; post: PublicPost } | null> {
  const cookie = (await headers()).get('cookie') ?? ''
  return get(`/api/preview/${encodeURIComponent(id)}`, { ...uncached, headers: { cookie } })
}

export async function getSitemap(): Promise<PublicSitemap> {
  return (await get<PublicSitemap>('/api/public/sitemap', cached(TAG.sitemap, TAG.pages, TAG.posts))) ?? { pages: [], posts: [], translations: [] }
}

/**
 * Where a path that has no page or post now lives (a renamed page or post, or an old /<slug> news URL), or null.
 * Only called when a page is not found.
 */
export async function resolveRedirect(path: string): Promise<string | null> {
  const body = await get<{ redirect: string | null }>(`/api/public/resolve?path=${encodeURIComponent(path)}`, cached(TAG.redirects, TAG.pages, TAG.posts))
  return body?.redirect ?? null
}
