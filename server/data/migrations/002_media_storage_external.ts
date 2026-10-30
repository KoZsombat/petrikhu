/**
 * Media bytes are stored uncompressed, out of line (TOAST): so serving (lib/media.ts) uses
 * `substring()` to read only the requested slice, not the whole file. Images and PDFs are compressed anyway.
 * It only affects new / rewritten rows; existing ones remain readable the old way.
 */
import type pg from 'pg'

export async function up(client: pg.PoolClient): Promise<void> {
  await client.query('ALTER TABLE media_files ALTER COLUMN data SET STORAGE EXTERNAL')
}
