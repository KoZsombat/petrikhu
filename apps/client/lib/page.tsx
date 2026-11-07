import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@/components/blocks/PageRenderer'
import { getPage } from '@/lib/api'
import { pageHref, t } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/meta'
import { JsonLd } from '@/components/JsonLd'
import { breadcrumbData } from '@/lib/structured'

export type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const flat = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))

/** A page document of the given locale, rendered on the server. */
export async function renderPage(locale: Locale, slug: string, searchParams: Record<string, string | string[] | undefined>) {
  const page = await getPage(locale, slug)
  if (!page) notFound()
  const breadcrumb = breadcrumbData(page.blocks, pageHref(locale, slug))
  return (
    <>
      {breadcrumb && <JsonLd data={breadcrumb} />}
      <PageRenderer blocks={page.blocks} ctx={{ locale, t: t(locale), path: pageHref(locale, slug), searchParams: flat(searchParams) }} />
    </>
  )
}

/**
 * Title, description, share data, canonical URL (with the news list's category and page, which are distinct
 * pages) and, for translated pages, hreflang links to both versions (Hungarian as x-default).
 */
export async function pageMeta(locale: Locale, slug: string, searchParams: Record<string, string | string[] | undefined> = {}): Promise<Metadata> {
  const page = await getPage(locale, slug)
  if (!page) return { title: t(locale)('common.notFound'), robots: { index: false } }
  const params = new URLSearchParams()
  const query = flat(searchParams)
  for (const key of ['kategoria', 'oldal']) if (query[key]) params.set(key, query[key]!)
  const path = pageHref(locale, slug) + (params.size ? `?${params}` : '')
  const meta = pageMetadata(page, path)
  if (page.alternate) {
    const own = pageHref(locale, slug)
    const other = pageHref(page.alternate.locale, page.alternate.slug)
    const hu = locale === 'hu' ? own : other
    meta.alternates = { ...meta.alternates, languages: { hu, en: locale === 'en' ? own : other, 'x-default': hu } }
  }
  return meta
}
