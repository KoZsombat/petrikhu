/**
 * A napló már nem csak a híreké: oldal, menü, Dokumentumtár és fiók eseménye is bekerül. Minden bejegyzésnek
 * van tárgytípusa (`entity_type`), azonosítója (`entity_id`) és a tárgy akkori neve (`subject`: egy törölt
 * oldal / fiók neve is olvasható marad). A meglévő bejegyzések hírek.
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
