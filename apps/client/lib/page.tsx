import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@/components/blocks/PageRenderer'
import { getPage } from '@/lib/api'
import { pageHref, t } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/meta'

export type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const flat = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))

/** A page document of the given locale, rendered on the server. */
export async function renderPage(locale: Locale, slug: string, searchParams: Record<string, string | string[] | undefined>) {
  const page = await getPage(locale, slug)
  if (!page) notFound()
  return <PageRenderer blocks={page.blocks} ctx={{ locale, t: t(locale), path: pageHref(locale, slug), searchParams: flat(searchParams) }} />
}

export async function pageMeta(locale: Locale, slug: string): Promise<Metadata> {
  const page = await getPage(locale, slug)
  if (!page) return { title: t(locale)('common.notFound'), robots: { index: false } }
  const meta = pageMetadata(page, pageHref(locale, slug))
  if (page.alternate) {
    meta.alternates = { ...meta.alternates, languages: { [page.alternate.locale]: pageHref(page.alternate.locale, page.alternate.slug) } }
  }
  return meta
}
