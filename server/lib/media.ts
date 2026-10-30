/**
 * Serving media out of the database (data/media-repo.ts) and filling it from
 * folders: the mirrored `public/media` tree, and any files an older install
 * left in the uploads folder.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { Router } from 'express'
import { getMedia, hasMedia, mediaKey, putMediaIfMissing } from '../data/media-repo.ts'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.rtf': 'application/rtf', '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff',
}

export function mimeFor(name: string): string {
  return MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'
}

/** What the browser may do with a stored file: scripts and HTML are never rendered from here. */
const INLINE_SAFE = /^(image\/(?!svg)|application\/pdf|video\/|font\/)/

/**
 * `GET /<prefix>/<path>` from the database. A miss falls through (next()), so
 * the static fallbacks behind it - or a plain 404 - still apply.
 */
export function mediaRouter(prefix: string, maxAgeSeconds: number): Router {
  const router = Router()
  router.get('/*path', async (req, res, next) => {
    let path: string
    try {
      path = decodeURIComponent(req.path)
    } catch {
      next()
      return
    }
    if (path.includes('..') || path.includes('\0')) {
      next()
      return
    }
    const file = await getMedia(`${prefix}${path}`)
    if (!file) {
      next()
      return
    }
    const etag = `"${file.size}-${Date.parse(file.modifiedAt)}"`
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`)
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end()
      return
    }
    res.setHeader('Content-Type', file.mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // An uploaded SVG or office file is downloaded or sandboxed, never run in the site's origin.
    if (!INLINE_SAFE.test(file.mime)) {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:")
    }
    res.setHeader('Content-Length', String(file.data.length))
    res.end(file.data)
  })
  return router
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

/**
 * Copies every file under `dir` into the database as `<prefix>/<relative path>`,
 * skipping those already stored (a stat and an indexed lookup per file, so a
 * restart with nothing new is quick). Dotfiles and extension-less names - the
 * temp files an interrupted upload leaves behind - are skipped. Returns how
 * many were added.
 */
export async function importDirectory(dir: string, prefix: string): Promise<number> {
  let added = 0
  try {
    if (!statSync(dir).isDirectory()) return 0
  } catch {
    return 0
  }
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split(sep).join('/')
    if (rel.split('/').some((part) => part.startsWith('.')) || !extname(rel)) continue
    const key = mediaKey(`${prefix}/${rel}`)
    if (await hasMedia(key)) continue
    const info = statSync(file)
    if (await putMediaIfMissing(key, mimeFor(rel), readFileSync(file), info.mtime.toISOString())) added += 1
  }
  return added
}
