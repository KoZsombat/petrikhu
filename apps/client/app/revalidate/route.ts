/**
 * POST /revalidate — the API tells the site which cached data changed: `{ tags: string[] }`, with the shared
 * secret PNW_REVALIDATE_SECRET in `x-revalidate-secret`. The tags expire at once, so the next request reads
 * fresh data. Without a configured secret the endpoint does not exist.
 */
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

const SECRET = process.env.PNW_REVALIDATE_SECRET ?? ''

function authorized(given: string | null): boolean {
  if (!SECRET || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!authorized(request.headers.get('x-revalidate-secret'))) return Response.json({ error: 'forbidden' }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0 && tag.length <= 300).slice(0, 64) : []
  if (!tags.length) return Response.json({ error: 'no_tags' }, { status: 400 })
  for (const tag of tags) revalidateTag(tag, { expire: 0 })
  return Response.json({ ok: true, revalidated: tags.length })
}
