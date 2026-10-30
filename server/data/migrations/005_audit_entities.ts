/**
 * The log is no longer only for posts: page, menu, library and account events go in too. Every entry
 * has a subject type (`entity_type`), an id (`entity_id`) and the subject's name at the time (`subject`: a deleted
 * page's / account's name stays readable). Existing entries are posts.
 */
import type pg from 'pg'

export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE audit_log
      ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'post',
      ADD COLUMN IF NOT EXISTS entity_id TEXT,
      ADD COLUMN IF NOT EXISTS subject TEXT
  `)
  await client.query("UPDATE audit_log SET entity_id = post_id WHERE entity_type = 'post' AND entity_id IS NULL")
  await client.query('CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log(entity_type, entity_id)')
}
