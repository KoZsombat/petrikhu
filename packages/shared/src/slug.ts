/** Lowercase, accents removed - for case- and accent-insensitive search and comparison. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** A URL slug from a title: accents removed, kebab-case. `fallback` when nothing is left. */
export function slugify(title: string, fallback = 'hir'): string {
  const base = fold(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || fallback
}

/** Appends -2, -3, … until the slug is not in `taken`. */
export function uniqueSlug(title: string, taken: ReadonlySet<string>): string {
  const base = slugify(title)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Slugs a page may not take, because a fixed route of the public site or the server would hide it.
 * Keep in sync with apps/client/app and apps/server/src/app.ts (tests/reserved-slugs.test.ts checks the client).
 */
export const RESERVED_SLUGS = [
  'api', 'uploads', 'media', 'healthz', 'admin', '_next', 'en', 'hirek', 'kereses', 'elonezet', 'about-us',
  'favicon.ico', 'robots.txt', 'sitemap.xml',
] as const

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug)
}
