/**
 * A Hírkezelő / Szerkesztő PostgreSQL adatbázisa. A kapcsolat a `DATABASE_URL`-ből jön; a séma idempotens
 * (`CREATE TABLE IF NOT EXISTS`), így üres és meglévő adatbázison is minden induláskor lefuthat.
 *
 * A JSON-oszlopok (blocks, content, permissions...) szövegként tárolódnak, ahogy korábban is: a validálás a
 * belépéskor történik (server/lib/validation.ts), a repók JSON.parse-olnak.
 */
import pg from 'pg'
import { DATABASE_URL } from '../config.ts'

// A BIGINT (20) és a NUMERIC alapból string: a munkamenet-lejárat ms-ben van, belefér egy Number-be.
pg.types.setTypeParser(20, (value) => Number(value))

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
pool.on('error', (error) => console.error('[pnw] postgres pool error', error))

export type Queryable = Pick<pg.Pool, 'query'>

/** Egy lekérdezés; a sorokat adja vissza. */
export async function rows<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[]
}

export async function row<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(text, params))[0]
}

/** INSERT/UPDATE/DELETE: az érintett sorok száma. */
export async function run(text: string, params: unknown[] = []): Promise<number> {
  return (await pool.query(text, params)).rowCount ?? 0
}

export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export const SCHEMA = `
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
`

/** Induláskor egyszer: megvárja az adatbázist (compose-ban a Postgres kicsit később áll fel), majd létrehozza a sémát. */
export async function initDb(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (error) {
      if (attempt >= 30) throw error
      console.log(`[pnw] várakozás a PostgreSQL-re (${attempt}/30)...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  await pool.query(SCHEMA)
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
