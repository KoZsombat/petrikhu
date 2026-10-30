/**
 * `posts.search_text`: the search text (data/post-search.ts), so that searching published / archived posts
 * runs in the database. Existing rows are filled here; the repo recalculates it on every save.
 */
import type pg from 'pg'
import { searchTextOf } from '../post-search.ts'

export async function up(client: pg.PoolClient): Promise<void> {
  await client.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_text TEXT')
  const { rows } = await client.query<{ id: string; title: string; content: string }>('SELECT id, title, content FROM posts')
  for (const row of rows) {
    let content = []
    try {
      content = JSON.parse(row.content)
    } catch {
      // broken content: only the title is searchable
    }
    await client.query('UPDATE posts SET search_text = $2 WHERE id = $1', [row.id, searchTextOf(row.title, Array.isArray(content) ? content : [])])
  }
  // List ordering: within a status, by date / modification.
  await client.query('CREATE INDEX IF NOT EXISTS posts_status_date_idx ON posts(status, date)')
  await client.query('CREATE INDEX IF NOT EXISTS posts_status_modified_idx ON posts(status, modified_at)')
  await client.query('CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at)')
}
