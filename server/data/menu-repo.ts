/**
 * The edited menu - a single row. `null` means nobody has
 * edited it, and the site uses the built-in menu (src/lib/constants.ts).
 */
import type { MenuItem } from '../../shared/pnw/creator-types.ts'
import { row, run } from './db.ts'

export async function getMenu(): Promise<{ menu: MenuItem[]; modifiedAt: string } | null> {
  const found = await row<{ data: MenuItem[]; modified_at: string }>('SELECT data, modified_at FROM site_menu WHERE id = 1')
  return found ? { menu: found.data, modifiedAt: found.modified_at } : null
}

export async function putMenu(menu: MenuItem[]): Promise<void> {
  await run(
    `INSERT INTO site_menu (id, data, modified_at) VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, modified_at = excluded.modified_at`,
    [JSON.stringify(menu), new Date().toISOString()],
  )
}

export async function clearMenu(): Promise<void> {
  await run('DELETE FROM site_menu WHERE id = 1')
}
