/**
 * Login, logout, the current user, and changing one's own password. Better Auth does the session work;
 * these routes add the lockout and keep the response format.
 *
 * Lockout: 8 failed attempts per account *and IP* (so a stranger cannot lock a colleague out) and 30 per IP,
 * per 15 minutes. A successful login clears the account+IP counter.
 */
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { APIError } from 'better-auth/api'
import { changePasswordBody, loginBody } from '@petrik/shared/schemas'
import { capabilitiesOf } from '@petrik/shared/roles'
import type { AppEnv } from '../context.ts'
import { requireUser, userOf } from '../context.ts'
import { users } from '../db/schema.ts'
import { logAudit } from '../lib/audit.ts'
import { hashPassword, needsRehash, verifyPassword } from '../lib/auth.ts'
import { PASSWORD_MIN } from '@petrik/shared/schemas'
import { endSessions, findUserByUsername, passwordHashOf, setPassword, storePasswordHash } from '../lib/users.ts'
import { validate } from '../lib/validate.ts'

const auth = new Hono<AppEnv>()

/** Copies Better Auth's Set-Cookie headers onto our response. */
function forwardCookies(from: Headers, to: Headers) {
  for (const cookie of from.getSetCookie()) to.append('Set-Cookie', cookie)
}

auth.post('/login', validate('json', loginBody), async (c) => {
  const { username, password } = c.req.valid('json')
  if (!username || !password) return c.json({ error: 'empty_fields' }, 401)
  const { loginByIp, loginByAccount } = c.var.limits
  const ipKey = c.var.ip
  const accountKey = `${username.toLowerCase()}|${c.var.ip}`
  if (loginByAccount.blocked(accountKey) || !loginByIp.hit(ipKey)) {
    c.header('Retry-After', String(Math.max(loginByIp.retryAfterSeconds(ipKey), loginByAccount.retryAfterSeconds(accountKey))))
    return c.json({ error: 'too_many_attempts' }, 429)
  }

  let response: Response
  try {
    response = await c.var.auth.api.signInUsername({ body: { username, password, rememberMe: true }, headers: c.req.raw.headers, asResponse: true })
  } catch (error) {
    if (!(error instanceof APIError)) throw error
    response = new Response(null, { status: 401 })
  }
  if (!response.ok) {
    loginByAccount.hit(accountKey)
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  loginByAccount.reset(accountKey)

  const user = (await findUserByUsername(c.var.db, username))!
  // An imported account's old bcrypt hash is replaced by the current one; an old password shorter than today's
  // minimum keeps working once, but has to be changed.
  const hash = await passwordHashOf(c.var.db, user.id)
  let mustChangePassword = user.mustChangePassword
  if (hash && needsRehash(hash)) {
    await storePasswordHash(c.var.db, user.id, await hashPassword(password))
    if (password.length < PASSWORD_MIN && !mustChangePassword) {
      await c.var.db.update(users).set({ mustChangePassword: true }).where(eq(users.id, user.id))
      mustChangePassword = true
    }
  }

  forwardCookies(response.headers, c.res.headers)
  const sessionUser = { id: user.id, username: user.username ?? '', displayName: user.name, role: user.role, mustChangePassword }
  return c.json({ user: sessionUser, capabilities: capabilitiesOf(user.role) })
})

auth.post('/logout', async (c) => {
  const response = await c.var.auth.api.signOut({ headers: c.req.raw.headers, asResponse: true })
  forwardCookies(response.headers, c.res.headers)
  return c.json({ ok: true })
})

auth.get('/me', (c) => {
  const user = c.var.user
  if (!user) return c.json({ error: 'not_logged_in' }, 401)
  return c.json({ user, capabilities: capabilitiesOf(user.role) })
})

auth.get('/config', (c) => c.json({ demoLogins: c.var.config.showDemoLogins }))

/** Changing one's own password ends every other session of the account. */
auth.put('/password', requireUser, validate('json', changePasswordBody), async (c) => {
  const user = userOf(c)
  const { currentPassword, newPassword } = c.req.valid('json')
  const hash = await passwordHashOf(c.var.db, user.id)
  if (!hash || !(await verifyPassword(currentPassword, hash))) return c.json({ error: 'wrong_password' }, 422)
  if (await verifyPassword(newPassword, hash)) return c.json({ error: 'same_password' }, 422)
  await setPassword(c.var.db, user.id, newPassword, { mustChange: false })
  await endSessions(c.var.db, user.id, c.var.sessionId)
  await logAudit(c.var.db, { entityType: 'user', entityId: user.id, subject: user.username, action: 'password_changed', userId: user.id })
  return c.json({ ok: true })
})

export default auth
