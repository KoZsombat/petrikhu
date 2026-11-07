import type { Metadata } from 'next'
import type { Block } from '@petrik/shared/blocks'
import { translate } from '@petrik/shared/i18n'
import type { Locale } from '@/lib/i18n'

const PUBLIC_URL = process.env.PNW_PUBLIC_URL || 'http://localhost:4000'

/** The share image when a page has none of its own: the school building. */
const DEFAULT_IMAGE = { url: '/img/hero-1280.jpg', width: 1280, height: 790 }

/** Defaults of every page: title template, icons, Open Graph site data. */
export function baseMetadata(locale: Locale): Metadata {
  const name = translate(locale, 'site.name')
  return {
    metadataBase: new URL(PUBLIC_URL),
    title: { default: name, template: '%s | petrik.hu' },
    description: translate(locale, 'site.description'),
    icons: {
      icon: [
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    openGraph: { siteName: name, locale: locale === 'en' ? 'en_GB' : 'hu_HU', type: 'website', images: [DEFAULT_IMAGE] },
    twitter: { card: 'summary_large_image', images: [DEFAULT_IMAGE.url] },
  }
}

const clip = (text: string, max = 200) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** Open Graph data a page or post adds replaces the layout's as a whole, so every page repeats the shared fields. */
function openGraph(locale: Locale, extra: Record<string, unknown>, image?: string) {
  return { siteName: translate(locale, 'site.name'), locale: locale === 'en' ? 'en_GB' : 'hu_HU', images: [image ?? DEFAULT_IMAGE], ...extra }
}

/** Title, description and image of a page built from blocks (the first page title block gives the intro and cover). */
export function pageMetadata(page: { title: string; description: string; blocks: Block[]; locale: Locale }, path: string): Metadata {
  const head = page.blocks.find((b) => b.type === 'pageTitle')
  const intro = head?.type === 'pageTitle' ? head.props.intro : undefined
  const cover = head?.type === 'pageTitle' ? head.props.cover?.src : undefined
  const description = clip(page.description || intro || '') || undefined
  return {
    title: page.title,
    description,
    alternates: { canonical: path },
    openGraph: openGraph(page.locale, { type: 'website', title: page.title, description, url: path }, cover),
    twitter: { card: 'summary_large_image', title: page.title, description, images: [cover ?? DEFAULT_IMAGE.url] },
  }
}

export function postMetadata(post: { title: string; excerpt: string; image: string | null; publishedAt: string }, path: string): Metadata {
  const description = clip(post.excerpt) || undefined
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    openGraph: openGraph('hu', { type: 'article', title: post.title, description, url: path, publishedTime: post.publishedAt }, post.image ?? undefined),
    twitter: { card: 'summary_large_image', title: post.title, description, images: [post.image ?? DEFAULT_IMAGE.url] },
  }
}
