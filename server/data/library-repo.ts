/**
 * The edited Dokumentumtár - a single row, like the menu (menu-repo.ts).
 * `null` means nobody has edited it, and the site keeps using the bundled
 * index in src/data/docs.ts.
 */
import type { DocLibrary } from '../../shared/pnw/page-types.ts'
import { row, run } from './db.ts'

export async function getLibrary(): Promise<{ library: DocLibrary; modifiedAt: string } | null> {
  const found = await row<{ data: DocLibrary; modified_at: string }>('SELECT data, modified_at FROM site_library WHERE id = 1')
  return found ? { library: found.data, modifiedAt: found.modified_at } : null
}

export async function putLibrary(library: DocLibrary): Promise<void> {
  await run(
    `INSERT INTO site_library (id, data, modified_at) VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, modified_at = excluded.modified_at`,
    [JSON.stringify(library), new Date().toISOString()],
  )
}

export async function clearLibrary(): Promise<void> {
  await run('DELETE FROM site_library WHERE id = 1')
}
