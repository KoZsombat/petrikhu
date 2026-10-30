/**
 * Real types instead of the text columns inherited from SQLite: JSON → JSONB, dates → TIMESTAMPTZ,
 * `creator_pages.deleted` → BOOLEAN, and foreign keys to accounts / posts (all ON DELETE SET NULL, so that
 * a deleted account's posts and the log survive). One transaction: a failure in any step rolls everything back.
 *
 * Beforehand it checks that every value can be converted; if not, it stops with a readable error before anything changes.
 * Old dates without a time zone count as UTC. References to accounts / posts that no longer exist
 * (orphans) become NULL before the key is created.
 *
 * Rollback: there is no automatic down-migration - the supported way is restoring the pg_dump taken before the deploy.
 * The reverse by hand (returns everything except the orphan references):
 *   ALTER TABLE <t> ALTER COLUMN <dátum> TYPE TEXT USING to_char(<dátum> AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 *   ALTER TABLE <t> ALTER COLUMN <json> TYPE TEXT USING <json>::text;
 *   ALTER TABLE creator_pages ALTER COLUMN deleted TYPE INTEGER USING deleted::int;
 *   ALTER TABLE <t> DROP CONSTRAINT <t>_<oszlop>_fkey;  (and 'DELETE FROM schema_migrations WHERE version = 4')
 */
import type pg from 'pg'

const TIMESTAMPS: [table: string, columns: string[]][] = [
  ['creator_pages', ['created_at', 'modified_at']],
  ['posts', ['created_at', 'modified_at', 'date', 'last_reviewed_at', 'scheduled_for', 'archived_at']],
  ['audit_log', ['created_at']],
  ['terms', ['created_at']],
  ['site_menu', ['modified_at']],
  ['site_library', ['modified_at']],
  ['media_files', ['modified_at']],
]

const JSONS: [table: string, columns: string[]][] = [
  ['creator_pages', ['blocks']],
  ['posts', ['content', 'category_ids', 'tag_ids']],
  ['users', ['permissions']],
  ['site_menu', ['data']],
  ['site_library', ['data']],
]

/** [table, column, referenced table] - all ON DELETE SET NULL. */
const FOREIGN_KEYS: [string, string, string][] = [
  ['posts', 'author_id', 'users'],
  ['posts', 'last_reviewer_id', 'users'],
  ['posts', 'scheduled_by_id', 'users'],
  ['posts', 'archived_by_id', 'users'],
  ['creator_pages', 'author_id', 'users'],
  ['creator_pages', 'modified_by_id', 'users'],
  ['terms', 'created_by_id', 'users'],
  ['audit_log', 'user_id', 'users'],
  ['audit_log', 'post_id', 'posts'],
]

/** The columns that were required until now but can be NULL after an account / post is deleted. */
const BECOME_NULLABLE: [string, string][] = [
  ['posts', 'author_id'],
  ['creator_pages', 'author_id'],
  ['audit_log', 'post_id'],
]

async function preCheck(client: pg.PoolClient): Promise<void> {
  const problems: string[] = []
  const check = async (table: string, column: string, type: string) => {
    const { rows } = await client.query<{ id: string; value: string }>(
      `SELECT ${table === 'site_menu' || table === 'site_library' ? 'id::text' : table === 'media_files' ? 'path' : 'id'} AS id, ${column} AS value
       FROM ${table} WHERE ${column} IS NOT NULL AND NOT pg_input_is_valid(${column}, '${type}') LIMIT 5`,
    )
    for (const r of rows) problems.push(`${table}.${column} (${r.id}): ${JSON.stringify(String(r.value).slice(0, 60))} not ${type}`)
  }
  for (const [table, columns] of TIMESTAMPS) for (const column of columns) await check(table, column, 'timestamptz')
  for (const [table, columns] of JSONS) for (const column of columns) await check(table, column, 'jsonb')
  if (problems.length > 0) throw new Error(`the type conversion cannot run, fix these first:\n  ${problems.join('\n  ')}`)
}

export async function up(client: pg.PoolClient): Promise<void> {
  // Old values without a time zone count as UTC (only within this transaction).
  await client.query("SET LOCAL timezone = 'UTC'")
  await preCheck(client)

  for (const [table, columns] of TIMESTAMPS) {
    await client.query(`ALTER TABLE ${table} ${columns.map((c) => `ALTER COLUMN ${c} TYPE TIMESTAMPTZ USING ${c}::timestamptz`).join(', ')}`)
  }
  for (const [table, columns] of JSONS) {
    // The text default ('[]') must be dropped first, otherwise ALTER cannot convert the column.
    await client.query(
      `ALTER TABLE ${table} ${columns.map((c) => `ALTER COLUMN ${c} DROP DEFAULT, ALTER COLUMN ${c} TYPE JSONB USING ${c}::jsonb`).join(', ')}`,
    )
  }
  await client.query("ALTER TABLE posts ALTER COLUMN tag_ids SET DEFAULT '[]'::jsonb")
  await client.query("ALTER TABLE users ALTER COLUMN permissions SET DEFAULT '[]'::jsonb")
  await client.query(
    'ALTER TABLE creator_pages ALTER COLUMN deleted DROP DEFAULT, ALTER COLUMN deleted TYPE BOOLEAN USING deleted <> 0, ALTER COLUMN deleted SET DEFAULT false',
  )

  for (const [table, column] of BECOME_NULLABLE) await client.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`)
  for (const [table, column, target] of FOREIGN_KEYS) {
    const orphans = await client.query(
      `UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${target} t WHERE t.id = ${table}.${column})`,
    )
    if (orphans.rowCount) console.log(`[pnw] 004: ${table}.${column} - ${orphans.rowCount} orphaned references set to NULL`)
    await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey FOREIGN KEY (${column}) REFERENCES ${target}(id) ON DELETE SET NULL`)
  }

  // Filtering / statistics by category (jsonb_array_elements_text, @>).
  await client.query('CREATE INDEX IF NOT EXISTS posts_category_ids_idx ON posts USING GIN (category_ids)')
}
