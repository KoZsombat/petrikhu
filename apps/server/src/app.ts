/**
 * The Hono app, without listening: index.ts starts it, the tests run it in-process. Everything it needs
 * (database, auth, config, rate limiters) comes in as `deps`, so every test file gets its own.
 */
import { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { serveStatic } from 'hono/bun'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Role } from '@petrik/shared/roles'
import type { Config } from './config.ts'
import type { AppEnv, Deps } from './context.ts'
import type { Db } from './db/client.ts'
import { createAuth } from './lib/auth.ts'
import { bodyLimits } from './lib/limits.ts'
import { YOUTUBE_THUMB, ensureYouTubeThumbnail, serveMedia } from './lib/media.ts'
import { PasswordRuleError } from './lib/users.ts'
import { AccountBackoff, RateLimiter, clientIp, sameOriginOnly, securityHeaders } from './lib/security.ts'
import { audit, statistics } from './routes/audit.ts'
import auth from './routes/auth.ts'
import library from './routes/library.ts'
import media from './routes/media.ts'
import pages from './routes/pages.ts'
import posts from './routes/posts.ts'
import preview from './routes/preview.ts'
import publicRoutes from './routes/public.ts'
import terms from './routes/terms.ts'
import users from './routes/users.ts'

/** What an account with `mustChangePassword` may still call. */
const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/logout', '/api/auth/login', '/api/auth/config', '/api/auth/password']

export function createDeps(db: Db, config: Config): Deps {
  return {
    db,
    config,
    auth: createAuth(db, config),
    limits: {
      loginByIp: new RateLimiter(30, 15 * 60 * 1000),
      loginByAccount: new RateLimiter(8, 15 * 60 * 1000),
      accountBackoff: new AccountBackoff(),
      writesByIp: new RateLimiter(600, 5 * 60 * 1000),
      // Public searches (/api/public/posts?q=): 60 per IP per minute.
      searchByIp: new RateLimiter(60, 60 * 1000),
    },
  }
}

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>()
  const { config } = deps

  app.use(securityHeaders(config))
  app.use(async (c, next) => {
    for (const [key, value] of Object.entries(deps)) c.set(key as keyof Deps, value as never)
    let peer: string | undefined
    try {
      peer = getConnInfo(c).remote.address
    } catch {
      peer = undefined
    }
    c.set('ip', clientIp(c, config, peer))
    c.set('user', null)
    c.set('sessionId', null)
    await next()
  })

  app.get('/healthz', (c) => c.json({ ok: true }))

  // Media and uploads straight from the database: uploads have unique names (cached for a year), the old site's files for a day.
  for (const [prefix, maxAge] of [['/uploads', 31536000], ['/media', 86400]] as const) {
    app.on(['GET', 'HEAD'], `${prefix}/*`, async (c) => {
      let path: string
      try {
        path = decodeURIComponent(c.req.path)
      } catch {
        return c.notFound()
      }
      const served = await serveMedia(c.var.db, c.req.raw, path, maxAge)
      if (served) return served
      // A YouTube thumbnail the site asks for the first time: fetched once, then served like any file.
      const video = YOUTUBE_THUMB.exec(path)?.[1]
      if (video && (await ensureYouTubeThumbnail(c.var.db, video))) return (await serveMedia(c.var.db, c.req.raw, path, maxAge)) ?? c.notFound()
      return c.notFound()
    })
  }

  const api = new Hono<AppEnv>()
  api.use(async (c, next) => {
    await next()
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
  })
  api.use(sameOriginOnly(config))
  api.use(bodyLimits)
  // At most 600 modifying requests per IP per 5 minutes; reads are not limited (a school network shares one IP).
  api.use(async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD') return next()
    const limiter = c.var.limits.writesByIp
    if (!limiter.hit(c.var.ip)) {
      c.header('Retry-After', String(limiter.retryAfterSeconds(c.var.ip)))
      return c.json({ error: 'too_many_requests' }, 429)
    }
    await next()
  })
  api.use(async (c, next) => {
    if (c.req.header('cookie')?.includes('session_token')) {
      const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
      if (session) {
        const user = session.user as typeof session.user & { username?: string; role?: string; mustChangePassword?: boolean }
        c.set('user', { id: user.id, username: user.username ?? '', displayName: user.name, role: (user.role ?? 'inactive') as Role, mustChangePassword: !!user.mustChangePassword })
        c.set('sessionId', session.session.id)
      }
    }
    await next()
  })

  // An account that must change its password reaches only its session, logout, its own password change and the
  // public API (which needs no login anyway).
  api.use(async (c, next) => {
    if (c.var.user?.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.some((path) => c.req.path === path) && !c.req.path.startsWith('/api/public/')) {
      return c.json({ error: 'password_change_required' }, 403)
    }
    await next()
  })

  api.route('/auth', auth)
  api.route('/posts', posts)
  api.route('/pages', pages)
  api.route('/library', library)
  api.route('/media', media)
  api.route('/terms', terms)
  api.route('/users', users)
  api.route('/audit', audit)
  api.route('/statistics', statistics)
  api.route('/preview', preview)
  api.route('/public', publicRoutes)
  api.all('*', (c) => c.json({ error: 'not_found' }, 404))
  app.route('/api', api)

  // The admin app (a static Vite build) at /admin, with a single-page fallback.
  if (existsSync(config.adminDist)) {
    const root = relative(process.cwd(), config.adminDist) || '.'
    app.use(
      '/admin/assets/*',
      serveStatic({ root, rewriteRequestPath: (p) => p.replace(/^\/admin/, ''), onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }),
    )
    app.get('/admin/*', async (c) => {
      const file = Bun.file(join(config.adminDist, c.req.path.replace(/^\/admin\/?/, '')))
      if (c.req.path !== '/admin/' && c.req.path !== '/admin' && (await file.exists()) && !c.req.path.endsWith('/')) return new Response(file)
      c.header('Cache-Control', 'no-cache')
      return c.html(await Bun.file(join(config.adminDist, 'index.html')).text())
    })
  }

  app.onError((error, c) => {
    if (error instanceof PasswordRuleError) return c.json({ error: error.code }, 422)
    console.error('[petrik] unhandled error', error)
    return c.json({ error: 'server_error' }, 500)
  })
  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  return app
}
