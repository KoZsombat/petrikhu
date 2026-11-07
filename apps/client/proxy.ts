/**
 * Runs before every page request: a fresh nonce and the Content-Security-Policy (Next.js puts the nonce on its
 * own scripts). No API call here: old and renamed addresses are resolved only when a page is not found
 * (lib/page.tsx, app/(hu)/hirek/[slug]).
 * API, media, admin and static files are not matched: the API sets their headers itself.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function proxy(request: NextRequest) {
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
