/** A basic, dependency-free slugify - matches the mirror's own kebab-case slugs closely enough. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'hir'
}

/** Appends -2, -3, … until the slug isn't in `existing`. */
export function uniqueSlug(title: string, existing: ReadonlySet<string>): string {
  const base = slugify(title)
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
