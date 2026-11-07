/**
 * Media in the database: storing uploads (images get WebP / AVIF variants with sharp) and serving files with
 * ETags, long caching, single byte ranges and a sandbox for anything that must not render inline.
 *
 * Variants: `<path>?w=<width>&f=webp|avif`. The public site asks for 480/960/1600 px; an image narrower than
 * that gets its own width. Uploads are processed at once; files from before (the old site) get their variant
 * on the first request, then it is stored.
 */
import { and, desc, eq, like, sql } from 'drizzle-orm'
import { extname } from 'node:path'
import sharp from 'sharp'
import { slugify } from '@petrik/shared/slug'
import type { Db } from '../db/client.ts'
import { media, mediaVariants } from '../db/schema.ts'

export const VARIANT_WIDTHS = [480, 960, 1600] as const
export const VARIANT_FORMATS = ['avif', 'webp'] as const
type Format = (typeof VARIANT_FORMATS)[number]

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.rtf': 'application/rtf', '.zip': 'application/zip',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text', '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
}

export function mimeFor(name: string): string {
  return MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'
}

/** What a browser may render from here; everything else (SVG, HTML-ish, office files) is sandboxed. */
const INLINE_SAFE = /^(image\/(?!svg)|application\/pdf|video\/|font\/)/
const RESIZABLE = /^image\/(jpeg|png|webp|avif)$/

export const SANDBOX_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

/** Keys are URL paths, NFC-normalised (macOS file names are decomposed, browsers ask for composed). */
export const mediaKey = (path: string) => path.normalize('NFC')

/* --- upload checks ------------------------------------------------------------------------------- */

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv', '.zip'])

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const DOCUMENT_MAX_BYTES = 9 * 1024 * 1024

/** Whether the file's first bytes match the image type of its extension: a renamed file must not get in. */
export function looksLikeImage(bytes: Uint8Array, extension: string): boolean {
  const head = Buffer.from(bytes.subarray(0, 16))
  const ascii = (from: number, to: number) => head.subarray(from, to).toString('latin1')
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return head[0] === 0xff && head[1] === 0xd8
    case '.png':
      return head[0] === 0x89 && ascii(1, 4) === 'PNG'
    case '.gif':
      return ascii(0, 3) === 'GIF'
    case '.webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    case '.avif':
      return ascii(4, 8) === 'ftyp'
    case '.svg':
      return /^\s*(<\?xml|<svg)/i.test(Buffer.from(bytes.subarray(0, 256)).toString('utf8'))
    default:
      return false
  }
}

/**
 * An unguessable file name part: 128 random bits as 22 base64url characters. A document's address must not be
 * guessable from its name (wrongly uploaded files may hold personal data until they are deleted).
 */
export function randomName(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')
}

export type StoreResult = { ok: true; url: string; id: string } | { ok: false; error: 'not_an_image' | 'unsupported_file' | 'file_too_large' }

/** An uploaded image: checked, stored under a fresh name, variants made. */
export async function storeImage(db: Db, file: File, userId: string | null): Promise<StoreResult> {
  const extension = extname(file.name).toLowerCase()
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: 'file_too_large' }
  if (!file.type.startsWith('image/') || !IMAGE_EXTENSIONS.has(extension)) return { ok: false, error: 'not_an_image' }
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!looksLikeImage(bytes, extension)) return { ok: false, error: 'not_an_image' }
  const path = `/uploads/${randomName()}${extension}`
  const mime = mimeFor(path)
  let width: number | null = null
  let height: number | null = null
  if (RESIZABLE.test(mime)) {
    try {
      const meta = await sharp(bytes).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      return { ok: false, error: 'not_an_image' }
    }
  }
  const [row] = await db.insert(media).values({ path, mime, size: bytes.length, width, height, data: bytes, createdById: userId }).returning({ id: media.id })
  if (width) await makeVariants(db, row.id, bytes, width)
  return { ok: true, url: path, id: row.id }
}

/** A document for the library: a readable, slugified name plus an unguessable part. */
export async function storeDocument(db: Db, file: File, userId: string | null): Promise<StoreResult> {
  const extension = extname(file.name).toLowerCase()
  if (file.size > DOCUMENT_MAX_BYTES) return { ok: false, error: 'file_too_large' }
  if (!DOCUMENT_EXTENSIONS.has(extension)) return { ok: false, error: 'unsupported_file' }
  const base = slugify(file.name.slice(0, file.name.length - extension.length), 'dokumentum').slice(0, 60)
  const path = `/uploads/${base}-${randomName()}${extension}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const [row] = await db.insert(media).values({ path, mime: mimeFor(path), size: bytes.length, data: bytes, createdById: userId }).returning({ id: media.id })
  return { ok: true, url: path, id: row.id }
}

/** Stores one file under an exact path unless it exists (imports). Returns whether it was added. */
export async function putMediaIfMissing(db: Db, path: string, bytes: Buffer, createdAt?: Date): Promise<boolean> {
  const key = mediaKey(path)
  const mime = mimeFor(key)
  let width: number | null = null
  let height: number | null = null
  if (RESIZABLE.test(mime)) {
    const meta = await sharp(bytes).metadata().catch(() => null)
    width = meta?.width ?? null
    height = meta?.height ?? null
  }
  const added = await db
    .insert(media)
    .values({ path: key, mime, size: bytes.length, width, height, data: bytes, ...(createdAt ? { createdAt } : {}) })
    .onConflictDoNothing({ target: media.path })
    .returning({ id: media.id })
  return added.length > 0
}

const effectiveWidth = (requested: number, original: number) => Math.min(requested, original)

async function encode(bytes: Buffer, width: number, format: Format): Promise<Buffer> {
  encodeStats.count += 1
  const pipeline = sharp(bytes).rotate().resize({ width, withoutEnlargement: true })
  return format === 'avif' ? pipeline.avif({ quality: 55, effort: 4 }).toBuffer() : pipeline.webp({ quality: 78 }).toBuffer()
}

async function makeVariants(db: Db, mediaId: string, bytes: Buffer, originalWidth: number): Promise<void> {
  const widths = [...new Set(VARIANT_WIDTHS.map((w) => effectiveWidth(w, originalWidth)))]
  for (const width of widths) {
    for (const format of VARIANT_FORMATS) {
      const data = await encode(bytes, width, format)
      await db.insert(mediaVariants).values({ mediaId, width, format, size: data.length, data }).onConflictDoNothing()
    }
  }
}

/* --- variants on demand -------------------------------------------------------------------------- */

/** Encodes in progress, per `(mediaId, width, format)`: concurrent requests for a missing variant share one. */
const inFlight = new Map<string, Promise<{ size: number; createdAt: Date } | null>>()

/** Makes and stores one missing variant; null when the original cannot be encoded. Deduplicated per variant. */
export function ensureVariant(db: Db, mediaId: string, width: number, format: Format): Promise<{ size: number; createdAt: Date } | null> {
  const key = `${mediaId}:${width}:${format}`
  const running = inFlight.get(key)
  if (running) return running
  const job = (async () => {
    const [row] = await db.select({ data: media.data }).from(media).where(eq(media.id, mediaId))
    if (!row) return null
    const encoded = await encode(row.data, width, format).catch(() => null)
    if (!encoded) return null
    await db.insert(mediaVariants).values({ mediaId, width, format, size: encoded.length, data: encoded }).onConflictDoNothing()
    return { size: encoded.length, createdAt: new Date() }
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

/** How many encodes ran (tests). */
export const encodeStats = { count: 0 }

/**
 * Every missing variant of every resizable image (one-time, `bun run media:variants`), one at a time, so the
 * first visitors after a migration do not trigger the encodes. Returns how many were made.
 */
export async function generateMissingVariants(db: Db, log: (line: string) => void = () => {}): Promise<number> {
  const images = await db.select({ id: media.id, path: media.path, mime: media.mime, width: media.width }).from(media).where(sql`${media.width} IS NOT NULL`).orderBy(media.createdAt)
  let made = 0
  for (const image of images) {
    if (!image.width || !RESIZABLE.test(image.mime)) continue
    const existing = new Set((await db.select({ width: mediaVariants.width, format: mediaVariants.format }).from(mediaVariants).where(eq(mediaVariants.mediaId, image.id))).map((v) => `${v.width}:${v.format}`))
    for (const width of [...new Set(VARIANT_WIDTHS.map((w) => effectiveWidth(w, image.width!)))]) {
      for (const format of VARIANT_FORMATS) {
        if (existing.has(`${width}:${format}`)) continue
        if (await ensureVariant(db, image.id, width, format)) made += 1
        else log(`cannot encode ${image.path}`)
      }
    }
  }
  return made
}

/* --- serving --------------------------------------------------------------------------------------- */

type Info = { id: string; path: string; mime: string; size: number; width: number | null; createdAt: Date }

async function infoOf(db: Db, path: string): Promise<Info | undefined> {
  return (
    await db
      .select({ id: media.id, path: media.path, mime: media.mime, size: media.size, width: media.width, createdAt: media.createdAt })
      .from(media)
      .where(eq(media.path, mediaKey(path)))
      .limit(1)
  )[0]
}

/** `bytes=a-b`, `bytes=a-`, `bytes=-n` → [start, end]; undefined (whole file) for none or several ranges. */
export function parseRange(header: string | undefined, size: number): [number, number] | 'invalid' | undefined {
  if (!header) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) return undefined
  let start: number
  let end: number
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]))
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (start > end || start >= size) return 'invalid'
  return [start, end]
}

export const CHUNK_BYTES = 256 * 1024
/** Up to this size a response is read in one go (and gets a Content-Length); larger ones are streamed. */
const BUFFER_LIMIT = 8 * 1024 * 1024

/** The bytes from `start` to `end`, read slice by slice (only one slice in memory at a time). */
function streamSlices(db: Db, table: 'media' | 'variant', key: { id: string; width?: number; format?: string }, start: number, end: number): ReadableStream<Uint8Array> {
  let offset = start
  return new ReadableStream({
    async pull(controller) {
      if (offset > end) return controller.close()
      const length = Math.min(CHUNK_BYTES, end - offset + 1)
      const rows =
        table === 'media'
          ? await db.execute<{ chunk: Buffer }>(sql`SELECT substring(data FROM ${offset + 1}::int FOR ${length}::int) AS chunk FROM media WHERE id = ${key.id}`)
          : await db.execute<{ chunk: Buffer }>(
              sql`SELECT substring(data FROM ${offset + 1}::int FOR ${length}::int) AS chunk FROM media_variants WHERE media_id = ${key.id} AND width = ${key.width!} AND format = ${key.format!}`,
            )
      const chunk = rows[0]?.chunk
      if (!chunk || chunk.length === 0) return controller.close()
      controller.enqueue(new Uint8Array(chunk))
      offset += chunk.length
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  return new Response(stream).arrayBuffer()
}

async function respond(req: Request, opts: { etag: string; mime: string; size: number; maxAge: number; immutable: boolean; body: (start: number, end: number) => ReadableStream<Uint8Array> }): Promise<Response> {
  const headers = new Headers({
    ETag: opts.etag,
    'Cache-Control': `public, max-age=${opts.maxAge}${opts.immutable ? ', immutable' : ''}`,
    'Accept-Ranges': 'bytes',
    'Content-Type': opts.mime,
    'X-Content-Type-Options': 'nosniff',
  })
  if (!INLINE_SAFE.test(opts.mime)) headers.set('Content-Security-Policy', SANDBOX_CSP)
  if (req.headers.get('if-none-match') === opts.etag) return new Response(null, { status: 304, headers })
  let start = 0
  let end = opts.size - 1
  let status = 200
  const range = parseRange(req.headers.get('range') ?? undefined, opts.size)
  if (range === 'invalid') {
    headers.set('Content-Range', `bytes */${opts.size}`)
    return new Response(null, { status: 416, headers })
  }
  if (range) {
    ;[start, end] = range
    status = 206
    headers.set('Content-Range', `bytes ${start}-${end}/${opts.size}`)
  }
  headers.set('Content-Length', String(opts.size === 0 ? 0 : end - start + 1))
  if (req.method === 'HEAD' || opts.size === 0) return new Response(null, { status, headers })
  const length = end - start + 1
  return new Response(length <= BUFFER_LIMIT ? await collect(opts.body(start, end)) : opts.body(start, end), { status, headers })
}

/** Serves a stored file (or a variant of it); null when there is no such file. */
export async function serveMedia(db: Db, req: Request, path: string, maxAge: number): Promise<Response | null> {
  if (path.includes('..') || path.includes('\0')) return null
  const file = await infoOf(db, path)
  if (!file) return null
  const url = new URL(req.url)
  const requestedWidth = Number(url.searchParams.get('w'))
  const format = url.searchParams.get('f') as Format | null
  const immutable = file.path.startsWith('/uploads/')

  if (format && (VARIANT_FORMATS as readonly string[]).includes(format) && (VARIANT_WIDTHS as readonly number[]).includes(requestedWidth) && file.width && RESIZABLE.test(file.mime)) {
    const width = effectiveWidth(requestedWidth, file.width)
    let variant: { size: number; createdAt: Date } | null | undefined = (await db.select({ size: mediaVariants.size, createdAt: mediaVariants.createdAt }).from(mediaVariants).where(and(eq(mediaVariants.mediaId, file.id), eq(mediaVariants.width, width), eq(mediaVariants.format, format))).limit(1))[0]
    if (!variant) variant = (await ensureVariant(db, file.id, width, format))
    if (variant) {
      return respond(req, {
        etag: `"${file.id.slice(0, 8)}-${width}-${format}-${variant.size}"`,
        mime: `image/${format}`,
        size: variant.size,
        maxAge,
        immutable,
        body: (start, end) => streamSlices(db, 'variant', { id: file.id, width, format }, start, end),
      })
    }
  }
  return respond(req, {
    etag: `"${file.size}-${file.createdAt.getTime()}"`,
    mime: file.mime,
    size: file.size,
    maxAge,
    immutable,
    body: (start, end) => streamSlices(db, 'media', { id: file.id }, start, end),
  })
}

export async function listImages(db: Db, limit = 500, offset = 0) {
  const rows = await db
    .select({ id: media.id, path: media.path, size: media.size, width: media.width, height: media.height, createdAt: media.createdAt })
    .from(media)
    .where(and(like(media.path, '/uploads/%'), like(media.mime, 'image/%')))
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset)
  return rows.map((row) => ({ ...row, url: row.path, createdAt: row.createdAt.toISOString() }))
}

/* --- YouTube thumbnails --------------------------------------------------------------------------- */

export const YOUTUBE_THUMB = /^\/media\/youtube\/([\w-]{11})\.jpg$/
const thumbFailures = new Map<string, number>()
let thumbWindow = { start: 0, count: 0 }

/**
 * The thumbnail of a YouTube video, stored once under /media/youtube/<id>.jpg, so the site shows it before the
 * visitor chooses to load the player (no request to YouTube from the browser until then). At most 30 fetches a
 * minute, and a failed id is not retried for 10 minutes. Returns whether the file now exists.
 */
export async function ensureYouTubeThumbnail(db: Db, id: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const now = Date.now()
  if ((thumbFailures.get(id) ?? 0) > now) return false
  if (now - thumbWindow.start > 60_000) thumbWindow = { start: now, count: 0 }
  if (++thumbWindow.count > 30) return false
  const job = (async () => {
    try {
      const res = await fetcher(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { signal: AbortSignal.timeout(5000) })
      const bytes = Buffer.from(await res.arrayBuffer())
      if (!res.ok || bytes.length > 2 * 1024 * 1024 || !looksLikeImage(bytes, '.jpg')) throw new Error(`status ${res.status}`)
      await putMediaIfMissing(db, `/media/youtube/${id}.jpg`, bytes)
      return true
    } catch {
      thumbFailures.set(id, Date.now() + 10 * 60_000)
      return false
    }
  })()
  return job
}
