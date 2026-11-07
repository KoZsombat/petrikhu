/**
 * Server-side reads from the Hono API (never from the browser): every page is rendered with its content,
 * so nothing is swapped in after load. No caching here: an edit in the admin shows on the next request.
 */
import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import type { Locale, PublicPage, PublicPost, PublicPostSummary, PublicSite, PublicSitemap } from '@petrik/shared/schemas'

const API = process.env.PNW_API_URL ?? 'http://localhost:4001'

async function get<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store', ...init })
  if (res.status === 404 || res.status === 401) return null
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return (await res.json()) as T
}

export const getSite = cache(async (locale: Locale): Promise<PublicSite> => {
  const site = await get<PublicSite>(`/api/public/site/${locale}`)
  return site ?? { menu: [], library: { categories: [] }, translations: [] }
})

export const getPage = cache(async (locale: Locale, slug: string): Promise<PublicPage | null> => {
  return (await get<{ page: PublicPage }>(`/api/public/pages/${locale}/${encodeURIComponent(slug)}`))?.page ?? null
})

export const getPost = cache(async (slug: string): Promise<PublicPost | null> => {
  return (await get<{ post: PublicPost }>(`/api/public/posts/${encodeURIComponent(slug)}`))?.post ?? null
})

export async function getPosts(query: { limit?: number; offset?: number; category?: string; q?: string }): Promise<{ posts: PublicPostSummary[]; total: number }> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value))
  return (await get<{ posts: PublicPostSummary[]; total: number }>(`/api/public/posts?${params}`)) ?? { posts: [], total: 0 }
}

/** A preview made in the admin: the visitor's own session cookie is passed on, only its author can open it. */
export async function getPreview(id: string): Promise<{ kind: 'page'; page: PublicPage } | { kind: 'post'; post: PublicPost } | null> {
  const cookie = (await headers()).get('cookie') ?? ''
  return get(`/api/preview/${encodeURIComponent(id)}`, { headers: { cookie } })
}

export async function getSitemap(): Promise<PublicSitemap> {
  return (await get<PublicSitemap>('/api/public/sitemap')) ?? { pages: [], posts: [], translations: [] }
}
