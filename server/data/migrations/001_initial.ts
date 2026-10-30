/**
 * A kiinduló séma: pontosan az, amit a migrációk előtti db.ts minden induláskor futtatott. Az
 * `IF NOT EXISTS` miatt egy már meglévő adatbázison semmit nem változtat, csak rögzítődik.
 */
import type pg from 'pg'

export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
  CREATE TABLE IF NOT EXISTS creator_pages (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    blocks TEXT NOT NULL,
    status TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    author_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    modified_by_id TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    category_ids TEXT NOT NULL,
    tag_ids TEXT NOT NULL DEFAULT '[]',
    featured_image TEXT,
    image_position TEXT NOT NULL DEFAULT 'top',
    origin TEXT NOT NULL DEFAULT 'hirkezelo',
    author_id TEXT NOT NULL,
    status TEXT NOT NULL,
    review_note TEXT,
    last_reviewer_id TEXT,
    last_reviewed_at TEXT,
    scheduled_for TEXT,
    scheduled_by_id TEXT,
    archived_at TEXT,
    archived_by_id TEXT,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
  CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_post_idx ON audit_log(post_id);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS terms (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    route TEXT,
    created_at TEXT NOT NULL,
    created_by_id TEXT
  );
  CREATE INDEX IF NOT EXISTS terms_kind_idx ON terms(kind);

  -- A szerkesztett menü és Dokumentumtár: egy-egy sor, a teljes tartalom JSON-ként.
  CREATE TABLE IF NOT EXISTS site_menu (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    modified_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_library (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    modified_at TEXT NOT NULL
  );

  -- Minden média (tükrözött /media/... és feltöltött /uploads/...), lásd data/media-repo.ts.
  CREATE TABLE IF NOT EXISTS media_files (
    path TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    modified_at TEXT NOT NULL,
    data BYTEA NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires);
`)
}
