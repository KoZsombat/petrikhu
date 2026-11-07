/**
 * Previews through the API: the admin posts the unsaved page or post, gets an id, and the public site's
 * /elonezet/<id> renders it with the real components. Only the user who made it can open it; it expires after a day.
 */
import { Hono } from 'hono'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { can } from '@petrik/shared/roles'
import { previewBody } from '@petrik/shared/schemas'
import type { PublicPage, PublicPost } from '@petrik/shared/schemas'
import type { AppEnv } from '../context.ts'
import { requireUser, userOf } from '../context.ts'
import type { Db } from '../db/client.ts'
import { previews, terms } from '../db/schema.ts'
import { excerptOf } from '../lib/documents.ts'
import { validate } from '../lib/validate.ts'
import { firstImage } from '@petrik/shared/tiptap'

const routes = new Hono<AppEnv>()
routes.use(requireUser)

const DAY_MS = 24 * 60 * 60 * 1000

routes.post('/', validate('json', previewBody), async (c) => {
  const user = userOf(c)
  const body = c.req.valid('json')
  if (body.kind === 'page' ? !can(user, 'pages.manage') : !can(user, 'news.write') && !can(user, 'news.review') && !can(user, 'news.manage')) {
    return c.json({ error: 'forbidden' }, 403)
  }
  await c.var.db.delete(previews).where(lt(previews.createdAt, new Date(Date.now() - DAY_MS)))
  const [row] = await c.var.db.insert(previews).values({ userId: user.id, data: body }).returning({ id: previews.id })
  return c.json({ id: row.id, url: `/elonezet/${row.id}` }, 201)
})

async function categoryNames(db: Db, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const rows = await db.select({ id: terms.id, name: terms.name }).from(terms).where(inArray(terms.id, ids))
  return ids.map((id) => rows.find((r) => r.id === id)?.name).filter((n): n is string => !!n)
}

routes.get('/:id', async (c) => {
  const user = userOf(c)
  const id = c.req.param('id')
  if (!/^[0-9a-f-]{36}$/.test(id)) return c.json({ error: 'not_found' }, 404)
  const row = (await c.var.db.select().from(previews).where(and(eq(previews.id, id), eq(previews.userId, user.id))).limit(1))[0]
  if (!row || row.createdAt.getTime() < Date.now() - DAY_MS) return c.json({ error: 'not_found' }, 404)
  const data = previewBody.parse(row.data)
  if (data.kind === 'page') {
    const page: PublicPage = { slug: data.page.slug || 'elonezet', locale: data.page.locale ?? 'hu', title: data.page.title, description: data.page.description ?? '', blocks: data.page.blocks, alternate: null }
    return c.json({ kind: 'page', page })
  }
  const post: PublicPost = {
    slug: 'elonezet',
    title: data.post.title,
    excerpt: data.post.excerpt || excerptOf(data.post.content),
    publishedAt: new Date().toISOString(),
    categories: await categoryNames(c.var.db, data.post.categoryIds ?? []),
    image: data.post.featuredImage ?? firstImage(data.post.content) ?? null,
    content: data.post.content,
    featuredImage: data.post.featuredImage ?? null,
    imagePosition: data.post.imagePosition ?? 'top',
  }
  return c.json({ kind: 'post', post })
})

export default routes
