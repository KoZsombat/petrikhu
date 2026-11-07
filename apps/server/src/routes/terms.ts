/** Categories and tags. Anyone logged in may list and use them; creating needs `terms.create`. */
import { Hono } from 'hono'
import { and, asc, eq, sql } from 'drizzle-orm'
import { slugify } from '@petrik/shared/slug'
import { termCreateBody } from '@petrik/shared/schemas'
import type { AppEnv } from '../context.ts'
import { requireCap, requireUser, userOf } from '../context.ts'
import { terms } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { validate } from '../lib/validate.ts'

const routes = new Hono<AppEnv>()

routes.get('/', requireUser, async (c) => {
  const rows = await c.var.db.select({ id: terms.id, kind: terms.kind, name: terms.name, parentId: terms.parentId }).from(terms).orderBy(asc(sql`lower(${terms.name})`))
  return c.json({ terms: rows })
})

routes.post('/', requireCap('terms.create'), validate('json', termCreateBody), async (c) => {
  const user = userOf(c)
  const body = c.req.valid('json')
  const clash = await c.var.db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, body.kind), sql`lower(${terms.name}) = lower(${body.name})`)).limit(1)
  if (clash.length) return c.json({ error: 'term_exists' }, 409)
  if (body.parentId) {
    const parent = await c.var.db.select({ kind: terms.kind }).from(terms).where(eq(terms.id, body.parentId)).limit(1)
    if (parent[0]?.kind !== body.kind) return c.json({ error: 'invalid_parent' }, 422)
  }
  const id = `${slugify(body.name, body.kind)}-${crypto.randomUUID().slice(0, 6)}`
  const [term] = await c.var.db
    .insert(terms)
    .values({ id, kind: body.kind, name: body.name, parentId: body.parentId ?? null, createdById: user.id })
    .returning({ id: terms.id, kind: terms.kind, name: terms.name, parentId: terms.parentId })
  await logAudit(c.var.db, { entityType: 'term', entityId: term.id, subject: term.name, action: 'term_created', userId: user.id })
  return c.json({ term }, 201)
})

export default routes
