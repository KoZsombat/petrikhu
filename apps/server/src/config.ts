/** Every environment variable the API reads, in one place. See .env.example. */
import { resolve } from 'node:path'

const env = process.env

export const IS_PRODUCTION = env.NODE_ENV === 'production'

export const DEV_SECRET = 'petrik-dev-secret-change-me-0123456789abcdef'

export type Config = {
  databaseUrl: string
  port: number
  /** Signs the session cookies (Better Auth secret). */
  secret: string
  /** The site's public address, e.g. https://petrik.hu: the origin allowed to send modifying calls. */
  publicUrl: string
  allowedOrigins: string[]
  /**
   * The request header that carries the visitor's IP, set by the proxy at the edge (Cloudflare:
   * `cf-connecting-ip`, which a client cannot supply through the tunnel). Lowercase; undefined = not used.
   */
  clientIpHeader: string | undefined
  /**
   * Opt-in alternative: count this many trusted proxies from the right of X-Forwarded-For. 0 (the default) =
   * off. Only correct when every proxy in front appends an entry (the Next.js rewrite proxy does not).
   */
  trustProxy: number
  /** Password of the demo accounts seeded into an empty database (and the replacement for demo passwords in production). */
  seedPassword: string | undefined
  /** Username of the single admin seeded into an empty production database. */
  adminUsername: string
  showDemoLogins: boolean
  /** The built admin app, served at /admin. */
  adminDist: string
  /** Secure cookies: on behind HTTPS. */
  secureCookies: boolean
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const publicUrl = (env.PNW_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')
  const allowed = (env.PNW_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  const base: Config = {
    databaseUrl: env.DATABASE_URL || 'postgres://petrik:petrik@localhost:5432/petrik',
    port: Number(env.PNW_API_PORT ?? 4001),
    secret: env.PNW_SESSION_SECRET || DEV_SECRET,
    publicUrl,
    allowedOrigins: publicUrl ? [...allowed, publicUrl] : allowed,
    clientIpHeader: env.PNW_CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
    trustProxy: Math.max(0, Math.floor(Number(env.PNW_TRUST_PROXY ?? 0)) || 0),
    seedPassword: env.PNW_SEED_PASSWORD || undefined,
    adminUsername: env.PNW_ADMIN_USERNAME?.trim() || 'admin',
    showDemoLogins: env.PNW_SHOW_DEMO_LOGINS !== undefined ? env.PNW_SHOW_DEMO_LOGINS === 'true' : !IS_PRODUCTION,
    adminDist: env.PNW_ADMIN_DIST ? resolve(env.PNW_ADMIN_DIST) : resolve(import.meta.dir, '../../admin/dist'),
    secureCookies: publicUrl.startsWith('https://'),
  }
  return { ...base, ...overrides }
}

/** How often scheduled posts are checked (ms). */
export const SCHEDULE_CHECK_MS = 60_000
