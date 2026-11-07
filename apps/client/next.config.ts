import { resolve } from 'node:path'
import type { NextConfig } from 'next'

/** Where the Hono API listens (inside compose: http://api:4001). /api, /uploads, /media and /admin are proxied to it. */
const API = process.env.PNW_API_URL ?? 'http://localhost:4001'

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@petrik/shared'],
  reactCompiler: true,
  poweredByHeader: false,
  experimental: { globalNotFound: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
      { source: '/media/:path*', destination: `${API}/media/:path*` },
      { source: '/admin', destination: `${API}/admin/` },
      { source: '/admin/:path*', destination: `${API}/admin/:path*` },
    ]
  },
  async redirects() {
    // The old English page lived at /about-us.
    return [{ source: '/about-us', destination: '/en/about-us', statusCode: 301 }]
  },
}

export default config
