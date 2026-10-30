/**
 * Genuinely public endpoints - no requireLogin, unlike everything under
 * /api/posts (see AGENT.md 6.15). This is what the site's own static pages
 * (the sidebar's "Legutóbbi bejegyzések" widget, the homepage's feeds, and
 * the /hirek/:slug/ page) read a published Hírkezelő post through.
 */
import { Router } from 'express'
import { STATUS } from '../../shared/pnw/types.ts'
import type { Post } from '../../shared/pnw/types.ts'
import type { PublicSite } from '../../shared/pnw/creator-types.ts'
import { allPosts, findPostBySlug } from '../data/posts-repo.ts'
import { getPageBySlug, listPages } from '../data/pages-repo.ts'
import { getMenu } from '../data/menu-repo.ts'
import { getLibrary } from '../data/library-repo.ts'

const router = Router()

// Nyilvános, olvasható adat: egy percig a böngésző és a proxy is megtarthatja (az /api általános no-store-ját felülírja).
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60')
  next()
})

/** A hír első képe (kép- vagy galériablokk) - a kártyák miniatűrje, ha nincs kiemelt kép. */
function firstImage(content: Post['content']): string | undefined {
  for (const block of content) {
    const src = block.image?.src ?? block.gallery?.[0]?.src
    if (src) return src
  }
  return undefined
}

/**
 * A kiadott hírek, legfrissebb elöl, tartalom nélkül (a lista nézetnek csak a
 * kivonat kell, a teljes szöveget a GET /posts/:slug adja). A régi oldalról
 * importált (`mirror`) hírek is benne vannak.
 */
router.get('/posts', async (req, res) => {
  const limit = Math.min(1000, Number(req.query.limit) || 20)
  const posts = (await allPosts())
    .filter((post) => post.status === STATUS.PUBLISH)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(({ content, ...summary }) => ({ ...summary, thumbnail: summary.featuredImage ?? firstImage(content) }))
  res.json({ posts })
})

/**
 * Slugs of imported posts that are not on the site right now - archived or
 * trashed in the Hírkezelő. The client drops these from the mirror's lists,
 * which would otherwise keep showing a card for them.
 */
router.get('/posts/hidden-mirror', async (_req, res) => {
  const slugs = (await allPosts())
    .filter((post) => post.origin === 'mirror' && post.status !== STATUS.PUBLISH)
    .map((post) => post.slug)
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
 * Amit az oldalszerkesztő változtatott, egyben - a nyilvános oldal betöltéskor
 * egyszer kéri le (src/lib/SiteContentProvider.tsx), és sikertelen lekérés esetén
 * minden oldal a beépített tartalmát mutatja. Csak a kiadott, nem kukázott oldalak.
 */
router.get('/site', async (_req, res) => {
  const pages = (await listPages())
    .filter((page) => !page.deleted && page.status === 'publish')
    .map(({ slug, title, description, blocks }) => ({ slug, title, description, blocks }))
  const body: PublicSite = { pages, menu: (await getMenu())?.menu ?? null, library: (await getLibrary())?.library ?? null }
  res.json(body)
})

/** Egy kiadott oldal önmagában, a /<slug> közvetlen betöltéséhez. */
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
