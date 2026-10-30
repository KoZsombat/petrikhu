/**
 * Shared configuration for the /hirkezelo/ Express backend - see AGENT.md
 * 6.15. Mirrors the shape of scripts/mirror.ts's constants, one level up: a
 * single file every other server module reads paths and flags from.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))
/** The repo root - server/ is one level below it. */
export const PROJECT_ROOT = resolve(SERVER_ROOT, '..')

/** PostgreSQL kapcsolat (pl. postgres://petrik:jelszo@postgres:5432/petrik). */
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://petrik:petrik@localhost:5432/petrik'

/** A régi SQLite fájl helye - csak az egyszeri importáló szkript (server/scripts/import-sqlite.ts) használja. */
export const LEGACY_SQLITE_FILE = process.env.PNW_SQLITE_FILE
  ? resolve(process.env.PNW_SQLITE_FILE)
  : resolve(SERVER_ROOT, 'data/db/hirkezelo.db')

/** `PNW_UPLOADS_DIR` a régi, fájlrendszeres feltöltések mappája (induláskor bekerülnek az adatbázisba). */

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
 * A kliens build-kimenete: ugyanaz a folyamat szolgálja ki, mint az API-t (Dockerben is), így egyetlen porton
 * elérhető az egész oldal - ez kell a Cloudflare Tunnelhez.
 */
export const DIST_DIR = resolve(PROJECT_ROOT, 'dist')

export const PORT = Number(process.env.PNW_PORT ?? 4000)

/** Éles üzem: a Docker image NODE_ENV=production-nel fut. */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Hány fordított proxy áll az alkalmazás előtt (Cloudflare tunnel, nginx): ettől függ, hogy a `req.ip` és a
 * `req.secure` a valódi kliensre / HTTPS-re mutat-e. Élesben alapból 1, fejlesztésben 0.
 */
export const TRUST_PROXY = Number(process.env.PNW_TRUST_PROXY ?? (IS_PRODUCTION ? 1 : 0))

/** Az oldal nyilvános címe (pl. https://petrik.hu): automatikusan engedélyezett eredet a módosító API-hívásokhoz. */
export const PUBLIC_URL = (process.env.PNW_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')

/** Vesszővel elválasztott eredetek (pl. https://petrik.hu), ahonnan módosító API-hívás jöhet a saját hoszton kívül. */
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
 * The real plugin's PNW_TEST_MODE, ported as a real toggle rather than
 * hard-coded true - by explicit user request, approving a submission here
 * really publishes it (GET /api/public/posts, the /hirek/:slug/ page, the
 * site's recent-posts widgets - see AGENT.md 6.15). It never touches the
 * real petrik.hu mirror data (src/data/posts.ts) either way; this is its
 * own, separate SQLite database. Flip to `true` to restore the pilot's
 * approve-but-never-publish behavior without touching any route logic -
 * every TEST_MODE check in server/routes/posts.ts reads this one constant.
 */
export const TEST_MODE = false as const

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
