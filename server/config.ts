/**
 * Shared configuration for the /hirkezelo/ Express backend - see AGENTS.md "Server". Mirrors the shape of scripts/mirror.ts's constants, one level up: a
 * single file every other server module reads paths and flags from.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))
/** The repo root - server/ is one level below it. */
export const PROJECT_ROOT = resolve(SERVER_ROOT, '..')

/** PostgreSQL connection (e.g. postgres://petrik:jelszo@postgres:5432/petrik). */
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://petrik:petrik@localhost:5432/petrik'

/** Location of the old SQLite file - only the one-off import script (server/scripts/import-sqlite.ts) uses it. */
export const LEGACY_SQLITE_FILE = process.env.PNW_SQLITE_FILE
  ? resolve(process.env.PNW_SQLITE_FILE)
  : resolve(SERVER_ROOT, 'data/db/hirkezelo.db')

/** `PNW_UPLOADS_DIR`: the folder of the old file-system uploads (imported into the database on startup). */

export const UPLOADS_DIR = process.env.PNW_UPLOADS_DIR ? resolve(process.env.PNW_UPLOADS_DIR) : resolve(SERVER_ROOT, 'uploads')
export const UPLOADS_URL_PREFIX = '/uploads'

/**
 * Media lives in the database (data/media-repo.ts). Files found in these
 * folders at startup are copied in once: UPLOADS_DIR is what an install from
 * before that kept its uploads in, and `PNW_MEDIA_SEED_DIR` (default: the
 * client's public/media, where a checkout has the mirrored files) is the
 * mirrored images and PDFs, served as `/media/...`.
 */
export const MEDIA_URL_PREFIX = '/media'
export const MEDIA_SEED_DIR = process.env.PNW_MEDIA_SEED_DIR
  ? resolve(process.env.PNW_MEDIA_SEED_DIR)
  : resolve(PROJECT_ROOT, 'server/media-seed')

/**
 * The client build output: the same process that serves the API serves it too (in Docker as well), so
 * the whole site is reachable on one port - the Cloudflare Tunnel needs this.
 */
export const DIST_DIR = resolve(PROJECT_ROOT, 'dist')

export const PORT = Number(process.env.PNW_PORT ?? 4000)

/** Production: the Docker image runs with NODE_ENV=production. */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * How many reverse proxies sit in front of the app (Cloudflare tunnel, nginx); this decides whether `req.ip` and the
 * `req.secure` point at the real client / HTTPS. Defaults to 1 in production, 0 in development.
 */
export const TRUST_PROXY = Number(process.env.PNW_TRUST_PROXY ?? (IS_PRODUCTION ? 1 : 0))

/** The site's public address (e.g. https://petrik.hu): automatically an allowed origin for modifying API calls. */
export const PUBLIC_URL = (process.env.PNW_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')

/** Comma-separated origins (e.g. https://petrik.hu) that may send modifying API calls from outside the app's own host. */
export const ALLOWED_ORIGINS = (process.env.PNW_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .concat(PUBLIC_URL)
  .filter(Boolean)

/**
 * A real secret in production is an env var, not this fallback - but there is
 * no deployment pipeline for this yet, so a fixed dev default keeps `npm run
 * server` working out of the box for a pilot with a handful of known users.
 */
const DEV_SECRET = 'petrik-news-workflow-dev-secret-change-me'
export const SESSION_SECRET = process.env.PNW_SESSION_SECRET || DEV_SECRET

/**
 * The real plugin's PNW_TEST_MODE, as an env toggle (`PNW_TEST_MODE=true`, default off). Off: approving a
 * submission really publishes it (the public feed, /hirek/:slug). On - for a pilot or a training copy of the
 * site - an approval only marks the post `pnw_test_ok` and never publishes it, scheduling falls back to
 * "now", and editing / archiving published posts is refused (`production_only`). Every check is in
 * server/routes/posts.ts.
 */
export const TEST_MODE = process.env.PNW_TEST_MODE === 'true'

/** How often the schedule-publish sweep runs (ms). */
export const SCHEDULE_CHECK_INTERVAL_MS = 60_000

/**
 * Whether the login card prints the three seeded demo accounts and their
 * passwords. On by default for local runs (`npm run server`), off by default
 * in the Docker image (NODE_ENV=production) - a public deployment must never
 * advertise working credentials. `PNW_SHOW_DEMO_LOGINS=true|false` overrides.
 */
export const SHOW_DEMO_LOGINS =
  process.env.PNW_SHOW_DEMO_LOGINS !== undefined
    ? process.env.PNW_SHOW_DEMO_LOGINS === 'true'
    : process.env.NODE_ENV !== 'production'

/**
 * When set, the three accounts seeded into an **empty** database get this
 * password instead of the demo ones in users-repo.ts (which are in the repo,
 * hence public). Has no effect on a database that already has accounts.
 */
export const SEED_PASSWORD = process.env.PNW_SEED_PASSWORD || undefined

/** docker-compose.yml falls back to the same dev string, so this compares the value. */
export const USING_DEFAULT_SECRET = SESSION_SECRET === DEV_SECRET
