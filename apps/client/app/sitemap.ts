import type { MetadataRoute } from 'next'
import { getSitemap } from '@/lib/api'
import { absolute } from '@/lib/url'

// Built per request from the database (a new page or post appears at once), never at build time.
export const dynamic = 'force-dynamic'

/** Every published page (with its other-language version) and news post, plus the two home pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { pages, posts, translations } = await getSitemap()
  const enOf = new Map(translations.map((t) => [t.hu, t.en]))
  const huOf = new Map(translations.map((t) => [t.en, t.hu]))
  const pageUrl = (locale: string, slug: string) => absolute(locale === 'en' ? `/en/${slug}` : `/${slug}`)
  const newest = posts[0]?.updatedAt

  const entries: MetadataRoute.Sitemap = [
    { url: absolute('/'), lastModified: newest, changeFrequency: 'daily', priority: 1, alternates: { languages: { hu: absolute('/'), en: absolute('/en') } } },
    { url: absolute('/en'), lastModified: newest, changeFrequency: 'weekly', priority: 0.8, alternates: { languages: { hu: absolute('/'), en: absolute('/en') } } },
  ]
  for (const page of pages) {
    const other = page.locale === 'hu' ? enOf.get(page.slug) : huOf.get(page.slug)
    const languages = other ? (page.locale === 'hu' ? { hu: pageUrl('hu', page.slug), en: pageUrl('en', other) } : { hu: pageUrl('hu', other), en: pageUrl('en', page.slug) }) : undefined
    entries.push({
      url: pageUrl(page.locale, page.slug),
      lastModified: page.updatedAt,
      changeFrequency: page.slug === 'hirek' ? 'daily' : 'monthly',
      priority: page.slug === 'hirek' ? 0.9 : 0.7,
      ...(languages ? { alternates: { languages } } : {}),
    })
  }
  for (const post of posts) entries.push({ url: absolute(`/hirek/${post.slug}`), lastModified: post.updatedAt, changeFrequency: 'yearly', priority: 0.5 })
  return entries
}
