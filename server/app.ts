/**
 * The /hirkezelo/ backend - see AGENTS.md "Server" for why this exists and what it
 * knowingly does differently from the real WordPress plugin it re-implements.
 *
 * Builds the Express app without listening: server/index.ts starts it, the
 * tests (tests/) run it on a random port.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import compression from 'compression'
import express from 'express'
import session from 'express-session'
import { STATUS } from '../shared/pnw/types.ts'
import { DIST_DIR, MEDIA_URL_PREFIX, SESSION_SECRET, TRUST_PROXY, UPLOADS_URL_PREFIX } from './config.ts'
import { attachUser } from './middleware/auth.ts'
import { findPosts, updatePost } from './data/posts-repo.ts'
import { PgSessionStore } from './lib/pg-session-store.ts'
import { RateLimiter, apiNoStore, ipRateLimit, sameOriginOnly, securityHeaders } from './security.ts'
import { mediaRouter } from './lib/media.ts'
import { logAudit } from './lib/audit.ts'
import { notifyScheduledPublished } from './lib/notifications.ts'
import authRoutes from './routes/auth.ts'
import postRoutes from './routes/posts.ts'
import publicRoutes from './routes/public.ts'
import auditRoutes from './routes/audit.ts'
import statisticsRoutes from './routes/statistics.ts'
import usersRoutes from './routes/users.ts'
import termsRoutes from './routes/terms.ts'
import pageRoutes from './routes/pages.ts'
import libraryRoutes from './routes/library.ts'

/** Az Express alkalmazás, `listen` nélkül: az index.ts indítja, a tesztek (tests/) port 0-n futtatják. */
export function createApp(): express.Express {
  const app = express()
  app.disable('x-powered-by')
  if (TRUST_PROXY > 0) app.set('trust proxy', TRUST_PROXY)
  app.use(securityHeaders)
  app.use(compression())
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true })
  })

  // A Szerkesztő page document (AGENTS.md "Core idea: a page is JSON") easily outgrows express's 100 KB default
  // (the staff page alone is ~120 KB; nginx's client_max_body_size is 10m).
  app.use(express.json({ limit: '8mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(
    session({
      name: 'pnw.sid',
      secret: SESSION_SECRET,
      store: new PgSessionStore(),
      resave: false,
      saveUninitialized: false,
      // Egy bejelentkezés legfeljebb egy hétig él; használat közben a lejárat tovatolódik.
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        // HTTPS mögött (a proxy X-Forwarded-Proto-ja alapján) csak titkosított kapcsolaton megy a süti.
        secure: 'auto',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  )
  app.use(attachUser)

  // API: nincs gyorsítótár, módosító hívás csak a saját oldalról, és IP-nként legfeljebb 600 módosító kérés / 5 perc.
  app.use('/api', apiNoStore, sameOriginOnly, ipRateLimit(new RateLimiter(600, 5 * 60 * 1000)))

  // Uploads get a fresh uuid name each, the mirrored files never change: both cache hard.
  app.use(UPLOADS_URL_PREFIX, mediaRouter(UPLOADS_URL_PREFIX, 31536000))
  app.use(MEDIA_URL_PREFIX, mediaRouter(MEDIA_URL_PREFIX, 86400))

  app.use('/api/auth', authRoutes)
  app.use('/api/posts', postRoutes)
  app.use('/api/public', publicRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/statistics', statisticsRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/terms', termsRoutes)
  // Before /api/pages, whose router would refuse everyone without MANAGE_PAGES.
  app.use('/api/pages/library', libraryRoutes)
  app.use('/api/pages', pageRoutes)

  // The rest of the site is a static pixel-port that needs no server at all;
  // this only serves it too so `npm run server` is a complete way to run the
  // whole app after `npm run build` in one process. Dockerben is ez fut: egyetlen
  // port szolgálja ki az API-t és a klienst (Cloudflare Tunnel mögött is).
  if (existsSync(DIST_DIR)) {
    // A /assets alatti fájlok nevében a tartalom hash-e van: évekig gyorsítótárazhatók. A többi (index.html) mindig frissül.
    app.use(
      express.static(DIST_DIR, {
        index: false,
        setHeaders(res, path) {
          res.setHeader('Cache-Control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')
        },
      }),
    )
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith(UPLOADS_URL_PREFIX) || req.path.startsWith(MEDIA_URL_PREFIX + '/')) {
        next()
        return
      }
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(DIST_DIR, 'index.html'))
    })
  }


  // Ismeretlen /api cím: JSON 404 (ne az oldal HTML-je). Hibakezelő: a részletek a naplóba mennek, a kliens csak általános hibát kap.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })
  app.use((error: Error & { status?: number; type?: string; code?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }
    // A body-parser `type`-ot, a multer `code`-ot állít; a feltöltések elvileg acceptUpload-on mennek át, ez csak tartalék.
    if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'payload_too_large' })
      return
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' })
      return
    }
    console.error('[pnw] unhandled error', error)
    res.status(500).json({ error: 'server_error' })
  })

  return app
}

/** Ported from PNW_Actions::track_scheduled_publication() - WP-Cron has no equivalent here. */
export async function sweepScheduledPosts(): Promise<void> {
  const due = await findPosts({ status: STATUS.FUTURE, dateUntil: new Date().toISOString() }, { order: 'date_asc' })

  for (const post of due) {
    await updatePost(post.id, (p) => ({ ...p, status: STATUS.PUBLISH }))
    await logAudit(
      post.id,
      'scheduled_published',
      STATUS.FUTURE,
      STATUS.PUBLISH,
      'Az időzített hír automatikusan megjelent.',
    )
    notifyScheduledPublished(post)
  }
}

