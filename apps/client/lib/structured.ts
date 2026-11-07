/** schema.org data for search engines: the school, news articles and breadcrumbs. */
import type { Block } from '@petrik/shared/blocks'
import type { PublicPost } from '@petrik/shared/schemas'
import { translate } from '@petrik/shared/i18n'
import type { Locale } from '@/lib/i18n'
import { socialLinks } from '@/lib/site'
import { absolute } from '@/lib/url'

export function schoolData(locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HighSchool',
    '@id': absolute('/#school'),
    name: translate(locale, 'site.name'),
    alternateName: 'Petrik',
    url: absolute(locale === 'en' ? '/en' : '/'),
    logo: absolute('/img/logo-416.png'),
    image: absolute('/img/hero-1280.jpg'),
    description: translate(locale, 'site.description'),
    telephone: '+36 70 502 1724',
    email: 'info@petrik.hu',
    address: { '@type': 'PostalAddress', streetAddress: 'Thököly út 48–54.', postalCode: '1146', addressLocality: 'Budapest', addressCountry: 'HU' },
    sameAs: [socialLinks.facebook, socialLinks.instagram],
  }
}

export function articleData(post: PublicPost, path: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt || undefined,
    datePublished: post.publishedAt,
    inLanguage: 'hu',
    mainEntityOfPage: absolute(path),
    ...(post.image ? { image: [absolute(post.image)] } : {}),
    articleSection: post.categories[0],
    publisher: { '@type': 'Organization', '@id': absolute('/#school'), name: translate('hu', 'site.name'), logo: { '@type': 'ImageObject', url: absolute('/img/logo-416.png') } },
  }
}

/** The page title block's breadcrumb as a BreadcrumbList (the last item is the page itself). */
export function breadcrumbData(blocks: Block[], path: string): Record<string, unknown> | null {
  const head = blocks.find((b) => b.type === 'pageTitle')
  if (head?.type !== 'pageTitle' || head.props.breadcrumb.length < 2) return null
  const items = head.props.breadcrumb
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(i === items.length - 1 ? { item: absolute(path) } : item.href && item.href.startsWith('/') ? { item: absolute(item.href) } : {}),
    })),
  }
}
