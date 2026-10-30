/**
 * Every file the site serves that is not code: the mirrored images and PDFs
 * (`/media/...`) and everything uploaded through the Hírkezelő and the
 * Szerkesztő (`/uploads/...`), as rows of one table. The repo and the Docker
 * images carry no media; the database is the single place it lives, so a
 * backup of the database is a backup of the whole site.
 *
 * Keys are the public URL path, NFC-normalised (a macOS filesystem hands out
 * decomposed accents, a browser asks for composed ones).
 */
import { pool, row, rows, run } from './db.ts'

export type MediaFile = { path: string; mime: string; size: number; modifiedAt: string; data: Buffer }

export function mediaKey(path: string): string {
  return path.normalize('NFC')
}

export async function putMedia(path: string, mime: string, data: Buffer, modifiedAt = new Date().toISOString()): Promise<void> {
  await run(
    `INSERT INTO media_files (path, mime, size, modified_at, data) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(path) DO UPDATE SET mime = excluded.mime, size = excluded.size, modified_at = excluded.modified_at, data = excluded.data`,
    [mediaKey(path), mime, data.length, modifiedAt, data],
  )
}

/** For seeding: never overwrites what is already stored (an edit made through the site wins). */
export async function putMediaIfMissing(path: string, mime: string, data: Buffer, modifiedAt: string): Promise<boolean> {
  const changes = await run(
    `INSERT INTO media_files (path, mime, size, modified_at, data) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(path) DO NOTHING`,
    [mediaKey(path), mime, data.length, modifiedAt, data],
  )
  return changes > 0
}

export async function hasMedia(path: string): Promise<boolean> {
  return (await row('SELECT 1 FROM media_files WHERE path = $1', [mediaKey(path)])) !== undefined
}

export type MediaInfo = Omit<MediaFile, 'data'>

/** A fájl adatai a tartalma nélkül - a kiszolgálás ebből dönt (304, Range), mielőtt egy bájtot is olvasna. */
export async function getMediaInfo(path: string): Promise<MediaInfo | null> {
  const found = await row<{ path: string; mime: string; size: number; modified_at: string }>(
    'SELECT path, mime, size, modified_at FROM media_files WHERE path = $1',
    [mediaKey(path)],
  )
  return found ? { path: found.path, mime: found.mime, size: found.size, modifiedAt: found.modified_at } : null
}

export const MEDIA_CHUNK_BYTES = 256 * 1024

/**
 * A fájl `start`-tól `end`-ig (mindkettő bezárólag) darabokban, egyetlen kapcsolaton. Egyszerre csak egy darab
 * van a memóriában; a `data` oszlop STORAGE EXTERNAL (002-es migráció), így a Postgres is csak a kért szeletet
 * olvassa. Ha a hívó idő előtt kilép a ciklusból, a kapcsolat visszakerül a poolba.
 */
export async function* mediaChunks(path: string, start: number, end: number, chunkBytes = MEDIA_CHUNK_BYTES): AsyncGenerator<Buffer> {
  const client = await pool.connect()
  try {
    for (let offset = start; offset <= end; offset += chunkBytes) {
      const length = Math.min(chunkBytes, end - offset + 1)
      // A substring 1-től számoz.
      const result = await client.query<{ chunk: Buffer | null }>(
        'SELECT substring(data FROM $2::int FOR $3::int) AS chunk FROM media_files WHERE path = $1',
        [mediaKey(path), offset + 1, length],
      )
      const chunk = result.rows[0]?.chunk
      if (!chunk || chunk.length === 0) return
      yield chunk
    }
  } finally {
    client.release()
  }
}

/** Images stored under a URL prefix, newest first - no file contents. */
export async function listImageMedia(prefix: string): Promise<{ path: string; size: number; modifiedAt: string }[]> {
  const found = await rows<{ path: string; size: number; modified_at: string }>(
    `SELECT path, size, modified_at FROM media_files WHERE path LIKE $1 ESCAPE '\\' AND mime LIKE 'image/%' ORDER BY modified_at DESC`,
    [`${prefix.replace(/[\\%_]/g, '\\$&')}%`],
  )
  return found.map((item) => ({ path: item.path, size: item.size, modifiedAt: item.modified_at }))
}
