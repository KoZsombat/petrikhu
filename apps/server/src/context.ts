import { createMiddleware } from 'hono/factory'
import type { Capability } from '@petrik/shared/roles'
import { can } from '@petrik/shared/roles'
import type { SessionUser } from '@petrik/shared/schemas'
import type { Config } from './config.ts'
import type { Db } from './db/client.ts'
import type { Auth } from './lib/auth.ts'
import type { AccountBackoff, RateLimiter } from './lib/security.ts'

export type Deps = {
  db: Db
  auth: Auth
  config: Config
  limits: { loginByIp: RateLimiter; loginByAccount: RateLimiter; accountBackoff: AccountBackoff; writesByIp: RateLimiter }
}

export type AppEnv = {
  Variables: Deps & { user: SessionUser | null; sessionId: string | null; ip: string }
}

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: 'not_logged_in' }, 401)
  await next()
})

export function requireCap(...capabilities: Capability[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user
    if (!user) return c.json({ error: 'not_logged_in' }, 401)
    if (!capabilities.some((capability) => can(user, capability))) return c.json({ error: 'forbidden' }, 403)
    await next()
  })
}

/** The logged-in user (only inside routes behind requireUser / requireCap). */
export function userOf(c: { var: { user: SessionUser | null } }): SessionUser {
  if (!c.var.user) throw new Error('requireUser missing')
  return c.var.user
}
