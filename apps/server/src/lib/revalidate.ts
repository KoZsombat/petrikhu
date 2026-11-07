/**
 * Tells the public site which cached data changed (POST <PNW_SITE_URL>/revalidate with the shared secret
 * PNW_REVALIDATE_SECRET). Called after everything that changes public output. Never fails the API request: a
 * failure is logged, and the site's short `revalidate` interval catches up anyway.
 */
import { TAG } from '@petrik/shared/cache-tags'
import type { Config } from '../config.ts'

let warned = false

export async function revalidateSite(config: Pick<Config, 'siteUrl' | 'revalidateSecret'>, tags: string[]): Promise<void> {
  const unique = [...new Set(tags)].slice(0, 64)
  if (!unique.length) return
  if (!config.revalidateSecret) {
    if (!warned) console.warn('[petrik] PNW_REVALIDATE_SECRET is not set: the site shows changes only after its cache interval')
    warned = true
    return
  }
  try {
    const res = await fetch(`${config.siteUrl}/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': config.revalidateSecret },
      body: JSON.stringify({ tags: unique }),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) console.warn(`[petrik] revalidate ${unique.join(', ')}: the site answered ${res.status}`)
  } catch (error) {
    console.warn(`[petrik] revalidate ${unique.join(', ')} failed: ${(error as Error).message}`)
  }
}

/** The tags of a page: its own; also the lists when its address, status or translation changed. */
export function pageTags(locale: string, slugs: string[], structural: boolean): string[] {
  return [...slugs.map((slug) => TAG.page(locale, slug)), ...(structural ? [TAG.pages, TAG.site, TAG.sitemap, TAG.redirects] : [])]
}

/** The tags of a post that is (or was) public: its own page, the lists, the sitemap, old addresses. */
export function postTags(...slugs: string[]): string[] {
  return [...slugs.map((slug) => TAG.post(slug)), TAG.posts, TAG.sitemap, TAG.redirects]
}
