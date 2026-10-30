/**
 * Éles üzemhez szükséges védelmek, külső csomag nélkül: biztonsági fejlécek, Origin-ellenőrzés a
 * módosító API-hívásokon, és egy egyszerű, memóriában tartott kérésszám-korlátozó.
 */
import type { NextFunction, Request, Response } from 'express'
import { ALLOWED_ORIGINS } from './config.ts'

/**
 * A weboldal tartalma saját eredetű; a külső erőforrások: Google Fonts (betűtípus), YouTube (beágyazott videó),
 * és https-es képek (a hírekben külső kép is lehet). Szkript csak a saját csomagból futhat.
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

/** Az API-válaszokat (munkamenet, fiókok, piszkozatok) sosem tárolja gyorsítótár. */
export function apiNoStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF elleni védelem a SameSite=Lax süti mellé: módosító kérés csak a saját oldalról (vagy a
 * PNW_ALLOWED_ORIGINS-ben felsorolt eredetről) jöhet. Origin nélküli kérés (curl, szerver-szerver) átmegy: ahhoz nincs böngészős süti.
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

/** Kulcsonként (IP, felhasználónév) számolt, időablakos korlát; az ablak lejártával a számláló nullázódik. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private max: number
  private windowMs: number

  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
    setInterval(() => this.sweep(), windowMs).unref()
  }

  /** Beszámít egy kísérletet; false, ha a kulcs túllépte a korlátot. */
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

/** Módosító kérések (POST/PUT/DELETE) számának korlátja IP-nként (feltöltés-spam, túlterhelés ellen). */
export function ipRateLimit(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Az olvasás (GET) nincs korlátozva: egy iskolai hálózat egy IP mögött sok látogató.
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
