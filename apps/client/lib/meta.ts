import type { Metadata } from 'next'
import type { Block } from '@petrik/shared/blocks'
import { translate } from '@petrik/shared/i18n'
import type { Locale } from '@/lib/i18n'

const PUBLIC_URL = process.env.PNW_PUBLIC_URL || 'http://localhost:4000'

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
    openGraph: { siteName: name, locale: locale === 'en' ? 'en_GB' : 'hu_HU', type: 'website', images: ['/icon-192.png'] },
    twitter: { card: 'summary' },
  }
}

const clip = (text: string, max = 200) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** Title, description and image of a page built from blocks (the first page title block gives the intro and cover). */
export function pageMetadata(page: { title: string; description: string; blocks: Block[] }, path: string): Metadata {
  const head = page.blocks.find((b) => b.type === 'pageTitle')
  const intro = head?.type === 'pageTitle' ? head.props.intro : undefined
  const cover = head?.type === 'pageTitle' ? head.props.cover?.src : undefined
  const description = clip(page.description || intro || '') || undefined
  return {
    title: page.title,
    description,
    alternates: { canonical: path },
    openGraph: { title: page.title, description, url: path, ...(cover ? { images: [cover] } : {}) },
    twitter: { card: cover ? 'summary_large_image' : 'summary', title: page.title, description },
  }
}

export function postMetadata(post: { title: string; excerpt: string; image: string | null; publishedAt: string }, path: string): Metadata {
  const description = clip(post.excerpt) || undefined
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: post.title, description, url: path, publishedTime: post.publishedAt, ...(post.image ? { images: [post.image] } : {}) },
    twitter: { card: post.image ? 'summary_large_image' : 'summary', title: post.title, description },
  }
}
