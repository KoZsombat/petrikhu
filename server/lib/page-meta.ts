/**
 * Server-side meta injection: the app is a client-rendered SPA, so a crawler (Facebook, Messenger, Slack...)
 * only ever sees index.html. For the routes worth sharing - /hirek/:slug, a legacy news URL at /<slug>, a page
 * published from the Creator, a built-in page - the server fills in <title>, the description and the Open
 * Graph / Twitter card tags before sending index.html. Everything else gets the site defaults.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PROJECT_ROOT } from '../config.ts'
import { STATUS } from '../../shared/pnw/types.ts'
import type { Post } from '../../shared/pnw/types.ts'
import { documentText } from '../../shared/pnw/richtext.ts'
import { findPostBySlug } from '../data/posts-repo.ts'
import { getPageBySlug } from '../data/pages-repo.ts'

export const SITE_NAME = 'Petrik Lajos Két Tanítási Nyelvű Technikum'
const DEFAULT_DESCRIPTION = 'Vegyipari Környezetvédelmi és Informatikai Technikum a város szívében.'
const DEFAULT_IMAGE = '/icon-192.png'

export type PageMeta = { title: string; description: string; image?: string; type: 'website' | 'article'; publishedAt?: string }

type Block = { component: string; values: Record<string, unknown> }

/** The built-in pages (src/pages/samples, also copied into the Docker image), read once. */
let builtIn: { pages: Record<string, Block[]>; titles: Record<string, { hu: string }> } | undefined
function builtInPages() {
  if (!builtIn) {
    const read = (file: string) => {
      const path = resolve(PROJECT_ROOT, 'src/pages/samples', file)
      return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    }
    builtIn = { pages: read('pages.json'), titles: read('pageTitles.json') }
  }
  return builtIn
}

function clip(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

function postImage(post: Post): string | undefined {
  if (post.featuredImage) return post.featuredImage
  for (const block of post.content) {
    const src = block.image?.src ?? block.gallery?.[0]?.src
    if (src) return src
  }
  return undefined
}

function postMeta(post: Post): PageMeta {
  return {
    title: post.title,
    description: clip(post.excerpt || documentText(post.content)) || DEFAULT_DESCRIPTION,
    image: postImage(post),
    type: 'article',
    publishedAt: post.date,
  }
}

/** Title / intro / cover of a page built from blocks (the first PageTitle block). */
function blocksMeta(title: string | undefined, description: string | undefined, blocks: Block[]): PageMeta | null {
  const head = blocks.find((block) => block.component === 'PageTitle')?.values ?? {}
  const finalTitle = title || (typeof head.title === 'string' ? head.title : undefined)
  if (!finalTitle) return null
  const intro = typeof head.intro === 'string' ? head.intro : ''
  const cover = (head.cover as { src?: unknown } | undefined)?.src
  return { title: finalTitle, description: clip(description || intro) || DEFAULT_DESCRIPTION, image: typeof cover === 'string' && cover ? cover : undefined, type: 'website' }
}

/** The meta for a request path, or null for the site defaults. */
export async function metaFor(path: string): Promise<PageMeta | null> {
  const news = /^\/hirek\/([^/]+)\/?$/.exec(path)
  const single = /^\/([^/]+)\/?$/.exec(path)
  let slug: string
  try {
    slug = decodeURIComponent((news ?? single)?.[1] ?? '')
  } catch {
    return null
  }
  if (!slug) return null

  if (news) {
    const post = await findPostBySlug(slug)
    return post && post.status === STATUS.PUBLISH ? postMeta(post) : null
  }
  // Same precedence as the client (App.tsx): a published Creator page, then a built-in page, then a legacy news URL.
  const page = await getPageBySlug(slug)
  if (page && !page.deleted && page.status === 'publish') return blocksMeta(page.title, page.description, page.blocks as Block[])
  const { pages, titles } = builtInPages()
  if (pages[slug]) return blocksMeta(titles[slug]?.hu, undefined, pages[slug])
  const post = await findPostBySlug(slug)
  return post && post.status === STATUS.PUBLISH ? postMeta(post) : null
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function absolute(url: string, origin: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/** index.html with the page's <title>, description and og:/twitter: tags; `origin` makes the URLs absolute. */
export function renderIndex(template: string, meta: PageMeta | null, origin: string, path: string): string {
  const title = meta ? `${meta.title} | petrik.hu` : SITE_NAME
  const description = meta?.description ?? DEFAULT_DESCRIPTION
  const image = absolute(meta?.image ?? DEFAULT_IMAGE, origin)
  const tags = [
    ['og:site_name', SITE_NAME],
    ['og:locale', 'hu_HU'],
    ['og:type', meta?.type ?? 'website'],
    ['og:title', meta?.title ?? SITE_NAME],
    ['og:description', description],
    ['og:url', absolute(path, origin)],
    ['og:image', image],
    ...(meta?.publishedAt ? [['article:published_time', meta.publishedAt]] : []),
  ]
    .map(([property, content]) => `<meta property="${property}" content="${escape(content)}" />`)
    .concat(
      `<meta name="twitter:card" content="${meta?.image ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${escape(meta?.title ?? SITE_NAME)}" />`,
      `<meta name="twitter:description" content="${escape(description)}" />`,
      `<meta name="twitter:image" content="${escape(image)}" />`,
    )
    .join('\n    ')
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(description)}" />`)
    .replace('</head>', `    ${tags}\n  </head>`)
}
