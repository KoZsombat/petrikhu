/**
 * Runs before every page request:
 * - a fresh nonce and the Content-Security-Policy (Next.js puts the nonce on its own scripts);
 * - old news URLs at /<slug> get a 301 to /hirek/<slug> when no page has that slug (asks the API).
 * API, media, admin and static files are not matched: the API sets their headers itself.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API = process.env.PNW_API_URL ?? 'http://localhost:4001'

/** Single-segment paths the app itself serves. */
const OWN = new Set(['', 'hirek', 'kereses', 'en', 'about-us', 'robots.txt', 'favicon.ico', 'favicon-32.png', 'icon-192.png', 'apple-touch-icon.png'])

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes (animation delays, background images) need 'unsafe-inline'; scripts never do.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://sway.office.com https://sway.cloud.microsoft https://www.thinglink.com https://view.genial.ly https://view.genially.com https://online.fliphtml5.com https://www.facebook.com https://docs.google.com https://www.canva.com https://padlet.com',
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}

async function legacyRedirect(request: NextRequest): Promise<NextResponse | null> {
  const match = /^\/([^/]+)\/?$/.exec(request.nextUrl.pathname)
  if (!match || OWN.has(match[1]) || match[1].includes('.')) return null
  try {
    const res = await fetch(`${API}/api/public/resolve/${encodeURIComponent(decodeURIComponent(match[1]))}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { kind: string; redirect?: string }
    if (body.kind === 'post' && body.redirect) return NextResponse.redirect(new URL(body.redirect, request.url), 301)
  } catch {
    // API unreachable: the page itself shows its error
  }
  return null
}

export async function proxy(request: NextRequest) {
  const redirect = await legacyRedirect(request)
  if (redirect) return redirect

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const policy = csp(nonce)
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', policy)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  if (request.headers.get('x-forwarded-proto') === 'https') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|uploads|media|admin|_next/static|_next/image|img/|favicon|icon-|apple-touch-icon|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
