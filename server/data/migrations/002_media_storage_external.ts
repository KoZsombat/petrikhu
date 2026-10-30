/**
 * A média bájtjai tömörítés nélkül, külön (TOAST) tárolódnak: így a kiszolgálás (lib/media.ts) a
 * `substring()`-gel csak a kért szeletet olvassa, nem az egész fájlt. A képek, PDF-ek úgyis tömörítettek.
 * Csak az új / átírt sorokra hat; a meglévők a régi módon is helyesen olvashatók.
 */
import type pg from 'pg'

export async function up(client: pg.PoolClient): Promise<void> {
  await client.query('ALTER TABLE media_files ALTER COLUMN data SET STORAGE EXTERNAL')
}
