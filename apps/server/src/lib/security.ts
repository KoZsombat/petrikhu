/**
 * Security headers, the same-origin check for modifying calls, the client IP behind proxies and an
 * in-memory rate limiter.
 *
 * WARNING: the rate limiter keeps its state in process memory, so the app assumes a single instance (as does
 * the scheduled-publish sweep in index.ts). Two replicas would each allow the full limit.
 */
import type { Context, MiddlewareHandler } from 'hono'
import type { Config } from '../config.ts'

/** The admin app and API responses. The public site (Next.js) sets its own, nonce-based CSP. */
export const API_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

export function securityHeaders(config: Config): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const headers = c.res.headers
    if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', API_CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'SAMEORIGIN')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    if (config.secureCookies) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF protection next to the SameSite=Lax cookie: a modifying request that carries an Origin must come from
 * the site itself (the host the browser talked to, which Next.js forwards as X-Forwarded-Host) or from an
 * origin in PNW_PUBLIC_URL / PNW_ALLOWED_ORIGINS. Requests without an Origin (curl) carry no browser cookie.
 */
export function sameOriginOnly(config: Config): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin')
    if (!UNSAFE_METHODS.has(c.req.method) || !origin) return next()
    let host: string
    try {
      host = new URL(origin).host
    } catch {
      return c.json({ error: 'bad_origin' }, 403)
    }
    const forwardedHost = config.trustProxy > 0 ? c.req.header('x-forwarded-host')?.split(',')[0]?.trim() : undefined
    if (host === (forwardedHost || c.req.header('host')) || config.allowedOrigins.includes(origin)) return next()
    return c.json({ error: 'bad_origin' }, 403)
  }
}

/**
 * The client's IP: with N trusted proxies in front (Next.js; cloudflared in production), the address N hops
 * back along X-Forwarded-For + the socket peer.
 */
export function clientIp(c: Context, config: Config, peer: string | undefined): string {
  const hops = (c.req.header('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  hops.push(peer ?? 'unknown')
  const index = hops.length - 1 - config.trustProxy
  return hops[Math.max(0, index)] ?? 'unknown'
}

/** Fixed-window counter per key; resets when the window ends. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  constructor(
    private max: number,
    private windowMs: number,
  ) {
    setInterval(() => this.sweep(), windowMs).unref?.()
  }

  /** Counts one attempt; false when the key is over the limit. */
  hit(key: string): boolean {
    const now = Date.now()
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= this.max
  }

  blocked(key: string): boolean {
    const entry = this.hits.get(key)
    return !!entry && entry.resetAt > Date.now() && entry.count >= this.max
  }

  reset(key: string): void {
    this.hits.delete(key)
  }

  retryAfterSeconds(key: string): number {
    const entry = this.hits.get(key)
    return entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 1
  }

  private sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key)
  }
}
