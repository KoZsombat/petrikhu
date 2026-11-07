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
  /** How many proxies sit in front of the API (Next.js, plus cloudflared in production). */
  trustProxy: number
  /** Password of the demo accounts seeded into an empty database (and the replacement for demo passwords in production). */
  seedPassword: string | undefined
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
    trustProxy: Number(env.PNW_TRUST_PROXY ?? (IS_PRODUCTION ? 2 : 1)),
    seedPassword: env.PNW_SEED_PASSWORD || undefined,
    showDemoLogins: env.PNW_SHOW_DEMO_LOGINS !== undefined ? env.PNW_SHOW_DEMO_LOGINS === 'true' : !IS_PRODUCTION,
    adminDist: env.PNW_ADMIN_DIST ? resolve(env.PNW_ADMIN_DIST) : resolve(import.meta.dir, '../../admin/dist'),
    secureCookies: publicUrl.startsWith('https://'),
  }
  return { ...base, ...overrides }
}

/** How often scheduled posts are checked (ms). */
export const SCHEDULE_CHECK_MS = 60_000
