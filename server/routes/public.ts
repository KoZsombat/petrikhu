/**
 * Genuinely public endpoints - no requireLogin, unlike everything under
 * /api/posts (see AGENTS.md "Server"). This is what the site's own static pages
 * (the sidebar's "Legutóbbi bejegyzések" ("recent posts") widget, the homepage's feeds, and
 * the /hirek/:slug/ page) read a published Hírkezelő post through.
 */
import { Router } from 'express'
import { STATUS } from '../../shared/pnw/types.ts'
import type { Post } from '../../shared/pnw/types.ts'
import type { PublicSite } from '../../shared/pnw/creator-types.ts'
import { findPostBySlug, findPosts, postSlugs } from '../data/posts-repo.ts'
import { getPageBySlug, listPages } from '../data/pages-repo.ts'
import { getMenu } from '../data/menu-repo.ts'
import { getLibrary } from '../data/library-repo.ts'

const router = Router()

// Public, readable data: the browser and the proxy may keep it for a minute (overriding the general no-store of /api).
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60')
  next()
})

/** The first image of a post (image or gallery block) - the card thumbnail when there is no featured image. */
function firstImage(content: Post['content']): string | undefined {
  for (const block of content) {
    const src = block.image?.src ?? block.gallery?.[0]?.src
    if (src) return src
  }
  return undefined
}

/**
 * The published posts, newest first, without content (the list view only needs the
 * excerpt; the full text comes from GET /posts/:slug). Posts from the old site
 * imported (`mirror`) are included too.
 */
router.get('/posts', async (req, res) => {
  const limit = Math.min(1000, Number(req.query.limit) || 20)
  const posts = (await findPosts({ status: STATUS.PUBLISH }, { order: 'date_desc', limit: Math.max(1, limit) })).map(({ content, ...summary }) => ({ ...summary, thumbnail: summary.featuredImage ?? firstImage(content) }))
  res.json({ posts })
})

/**
 * Slugs of imported posts that are not on the site right now - archived or
 * trashed in the Hírkezelő. The client drops these from the mirror's lists,
 * which would otherwise keep showing a card for them.
 */
router.get('/posts/hidden-mirror', async (_req, res) => {
  const slugs = await postSlugs({ origin: 'mirror', statusNot: STATUS.PUBLISH })
  res.json({ slugs })
})

router.get('/posts/:slug', async (req, res) => {
  const post = await findPostBySlug(req.params.slug)
  if (!post || post.status !== STATUS.PUBLISH) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ post })
})

/**
 * Everything the page editor changed, in one go - the public site, on load,
 * fetches it once (src/lib/SiteContentProvider.tsx), and if the fetch fails every page
 * shows its built-in content. Only published, non-trashed pages.
 */
router.get('/site', async (_req, res) => {
  const pages = (await listPages())
    .filter((page) => !page.deleted && page.status === 'publish')
    .map(({ slug, title, description, blocks }) => ({ slug, title, description, blocks }))
  const body: PublicSite = { pages, menu: (await getMenu())?.menu ?? null, library: (await getLibrary())?.library ?? null }
  res.json(body)
})

/** One published page on its own, for loading /<slug> directly. */
router.get('/pages/:slug', async (req, res) => {
  const page = await getPageBySlug(req.params.slug)
  if (!page || page.deleted || page.status !== 'publish') {
    res.status(404).json({ error: 'not_found' })
    return
  }
  const { slug, title, description, blocks } = page
  res.json({ page: { slug, title, description, blocks } })
})

export default router
