/**
 * Redirects from the old public path of a renamed page or post to its current path (301 on the site).
 * Chains are collapsed when they form (A → B, then B → C gives A → C and B → C), loops are never stored, and a
 * redirect whose old path is a real page or post again is dropped.
 */
import { eq, sql } from 'drizzle-orm'
import type { Locale } from '@petrik/shared/schemas'
import type { Db } from '../db/client.ts'
import { redirects } from '../db/schema.ts'

export const pagePath = (locale: Locale | string, slug: string) => (locale === 'en' ? `/en/${slug}` : `/${slug}`)
export const postPath = (slug: string) => `/hirek/${slug}`

/** Records that `from` moved to `to`. */
export async function addRedirect(db: Db, from: string, to: string, userId: string | null): Promise<void> {
  if (from === to) return
  await db.transaction(async (tx) => {
    // `to` is a live path now: no redirect may start there.
    await tx.delete(redirects).where(eq(redirects.fromPath, to))
    // Whatever pointed at `from` points at `to` directly.
    await tx.update(redirects).set({ toPath: to }).where(eq(redirects.toPath, from))
    // A redirect that now points at itself (B → A after A → B) is a loop: gone.
    await tx.delete(redirects).where(sql`${redirects.fromPath} = ${redirects.toPath}`)
    await tx.insert(redirects).values({ fromPath: from, toPath: to, createdById: userId }).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: to, createdAt: new Date(), createdById: userId } })
  })
}

/** A page or post now lives at `path`: a redirect from there would hide it. */
export async function dropRedirectFrom(db: Db, path: string): Promise<void> {
  await db.delete(redirects).where(eq(redirects.fromPath, path))
}

export async function redirectFor(db: Db, path: string): Promise<string | null> {
  return (await db.select({ to: redirects.toPath }).from(redirects).where(eq(redirects.fromPath, path)).limit(1))[0]?.to ?? null
}
