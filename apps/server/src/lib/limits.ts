/**
 * Request body limits, decided per route in one place: small by default; large only where a whole page or
 * post is saved (or previewed); uploads get room for one file.
 */
import { bodyLimit } from 'hono/body-limit'
import type { MiddlewareHandler } from 'hono'

export const DEFAULT_BODY_BYTES = 100 * 1024
export const DOCUMENT_BODY_BYTES = 8 * 1024 * 1024
export const UPLOAD_BODY_BYTES = 10 * 1024 * 1024

const DOCUMENT_ROUTES = [/^\/api\/pages(\/[0-9a-f-]{36})?$/, /^\/api\/posts(\/[0-9a-f-]{36})?$/, /^\/api\/preview$/]
const UPLOAD_ROUTES = [/^\/api\/media$/, /^\/api\/library\/file$/]

const make = (maxSize: number, error = 'payload_too_large') => bodyLimit({ maxSize, onError: (c) => c.json({ error }, 413) })
const small = make(DEFAULT_BODY_BYTES)
const big = make(DOCUMENT_BODY_BYTES)
const upload = make(UPLOAD_BODY_BYTES, 'file_too_large')

export function limitFor(method: string, path: string): number {
  if (method !== 'POST' && method !== 'PUT') return DEFAULT_BODY_BYTES
  if (DOCUMENT_ROUTES.some((route) => route.test(path))) return DOCUMENT_BODY_BYTES
  if (UPLOAD_ROUTES.some((route) => route.test(path))) return UPLOAD_BODY_BYTES
  return DEFAULT_BODY_BYTES
}

export const bodyLimits: MiddlewareHandler = (c, next) => {
  const limit = limitFor(c.req.method, c.req.path)
  return (limit === DOCUMENT_BODY_BYTES ? big : limit === UPLOAD_BODY_BYTES ? upload : small)(c, next)
}
