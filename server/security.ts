/**
 * Production safeguards, without external packages: security headers, Origin checking on
 * modifying API calls, and a simple in-memory request rate limiter.
 */
import type { NextFunction, Request, Response } from 'express'
import { ALLOWED_ORIGINS } from './config.ts'

/**
 * The site's content is same-origin; external resources: Google Fonts (typefaces), YouTube (embedded video),
 * and https images (news posts may contain external images). Scripts may only run from the app's own bundle.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

/** API responses (sessions, accounts, drafts) are never cached. */
export function apiNoStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF protection alongside the SameSite=Lax cookie: modifying requests may only come from the site's own origin (or an
 * origin listed in PNW_ALLOWED_ORIGINS). Requests without an Origin (curl, server-to-server) pass: they carry no browser cookie.
 */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin')
  if (!UNSAFE_METHODS.has(req.method) || !origin) {
    next()
    return
  }
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    res.status(403).json({ error: 'bad_origin' })
    return
  }
  if (host === req.get('host') || ALLOWED_ORIGINS.includes(origin)) {
    next()
    return
  }
  res.status(403).json({ error: 'bad_origin' })
}

/**
 * Fixed-window limit counted per key (IP, username); the counter resets when the window expires.
 *
 * WARNING: the state lives in process memory, so a single instance is assumed. Behind two replicas
 * every limit would allow twice as much (login attempts too), and it resets on restart. For several instances
 * a shared store (e.g. a Postgres table or Redis) would be needed - currently deliberately absent.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private max: number
  private windowMs: number

  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
    setInterval(() => this.sweep(), windowMs).unref()
  }

  /** Counts one attempt; false if the key has exceeded the limit. */
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

/** Per-IP limit on modifying requests (POST/PUT/DELETE), against upload spam and overload. */
export function ipRateLimit(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Reads (GET) are not limited: a school network puts many visitors behind one IP.
    if (req.method === 'GET' || req.method === 'HEAD') {
      next()
      return
    }
    const key = req.ip ?? 'unknown'
    if (!limiter.hit(key)) {
      res.setHeader('Retry-After', String(limiter.retryAfterSeconds(key)))
      res.status(429).json({ error: 'too_many_requests' })
      return
    }
    next()
  }
}
