/**
 * Accounts. Every account with a role (`users.directory`, not `inactive`) gets a name directory (to show
 * authors); only `users.manage` sees usernames and roles and may change them. Setting someone's password ends
 * all of their sessions.
 */
import { Hono } from 'hono'
import { asc, eq, sql } from 'drizzle-orm'
import { can, ROLE_LABEL } from '@petrik/shared/roles'
import type { Role } from '@petrik/shared/roles'
import { userCreateBody, userUpdateBody } from '@petrik/shared/schemas'
import type { AppEnv } from '../context.ts'
import { requireCap, userOf } from '../context.ts'
import { users } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { hashPassword } from '../lib/auth.ts'
import { createUser, endSessions, findUserByUsername, hasOtherAdmin, placeholderEmail, setPasswordHash, toAccount } from '../lib/users.ts'
import { validate } from '../lib/validate.ts'

const routes = new Hono<AppEnv>()

routes.get('/', requireCap('users.directory', 'users.manage'), async (c) => {
  const rows = await c.var.db.select().from(users).orderBy(asc(sql`lower(${users.name})`))
  if (can(userOf(c), 'users.manage')) return c.json({ users: rows.map(toAccount) })
  return c.json({ users: rows.map((row) => ({ id: row.id, displayName: row.name })) })
})

routes.post('/', requireCap('users.manage'), validate('json', userCreateBody), async (c) => {
  const actor = userOf(c)
  const body = c.req.valid('json')
  if (await findUserByUsername(c.var.db, body.username)) return c.json({ error: 'username_taken' }, 409)
  const row = await createUser(c.var.db, { username: body.username, displayName: body.displayName, role: body.role, password: body.password })
  await logAudit(c.var.db, { entityType: 'user', entityId: row.id, subject: row.username, action: 'user_created', note: `Szerep: ${ROLE_LABEL[body.role]}`, userId: actor.id })
  return c.json({ user: toAccount(row) }, 201)
})

routes.put('/:id', requireCap('users.manage'), validate('json', userUpdateBody), async (c) => {
  const actor = userOf(c)
  const existing = (await c.var.db.select().from(users).where(eq(users.id, c.req.param('id'))).limit(1))[0]
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = c.req.valid('json')
  const clash = await findUserByUsername(c.var.db, body.username)
  if (clash && clash.id !== existing.id) return c.json({ error: 'username_taken' }, 409)
  // The last account manager cannot lose the right (nobody could manage accounts any more).
  if (!can({ role: body.role }, 'users.manage') && can(existing, 'users.manage') && !(await hasOtherAdmin(c.var.db, existing.id))) {
    return c.json({ error: 'last_manager' }, 400)
  }
  const username = body.username.trim().toLowerCase()
  const [row] = await c.var.db
    .update(users)
    .set({ username, displayUsername: body.username.trim(), email: placeholderEmail(username), name: body.displayName, role: body.role, updatedAt: new Date() })
    .where(eq(users.id, existing.id))
    .returning()
  if (body.password) {
    await setPasswordHash(c.var.db, existing.id, await hashPassword(body.password))
    await endSessions(c.var.db, existing.id, existing.id === actor.id ? c.var.sessionId : null)
  }
  const changes = [
    existing.role !== row.role ? `Szerep: ${ROLE_LABEL[existing.role as Role] ?? existing.role} → ${ROLE_LABEL[row.role as Role]}` : '',
    existing.username !== row.username ? `Felhasználónév: ${existing.username} → ${row.username}` : '',
    existing.name !== row.name ? `Név: ${existing.name} → ${row.name}` : '',
    body.password ? 'Jelszó megváltoztatva (minden munkamenete kijelentkeztetve)' : '',
  ].filter(Boolean)
  await logAudit(c.var.db, { entityType: 'user', entityId: row.id, subject: row.username, action: 'user_updated', note: changes.join('\n') || null, userId: actor.id })
  return c.json({ user: toAccount(row) })
})

routes.delete('/:id', requireCap('users.manage'), async (c) => {
  const actor = userOf(c)
  const id = c.req.param('id')
  if (id === actor.id) return c.json({ error: 'cannot_delete_self' }, 400)
  const existing = (await c.var.db.select().from(users).where(eq(users.id, id)).limit(1))[0]
  if (!existing) return c.json({ error: 'not_found' }, 404)
  if (can(existing, 'users.manage') && !(await hasOtherAdmin(c.var.db, existing.id))) return c.json({ error: 'last_manager' }, 400)
  await c.var.db.delete(users).where(eq(users.id, id))
  await logAudit(c.var.db, { entityType: 'user', entityId: id, subject: existing.username, action: 'user_deleted', userId: actor.id })
  return c.json({ ok: true })
})

export default routes
