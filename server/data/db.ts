/**
 * A Hírkezelő / Szerkesztő PostgreSQL adatbázisa. A kapcsolat a `DATABASE_URL`-ből jön; a sémát a
 * verziózott migrációk (data/migrate.ts, data/migrations/) hozzák létre és frissítik induláskor.
 *
 * A JSON-oszlopok (blocks, content, permissions...) szövegként tárolódnak, ahogy korábban is: a validálás a
 * belépéskor történik (server/lib/validation.ts), a repók JSON.parse-olnak.
 */
import pg from 'pg'
import { DATABASE_URL } from '../config.ts'
import { migrate } from './migrate.ts'

// A BIGINT (20) és a NUMERIC alapból string: a munkamenet-lejárat ms-ben van, belefér egy Number-be.
pg.types.setTypeParser(20, (value) => Number(value))
// TIMESTAMPTZ (1184): az alkalmazás mindenhol UTC ISO-szöveggel dolgozik (toISOString()), az API is ezt adja.
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString())

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


/** Induláskor egyszer: megvárja az adatbázist (compose-ban a Postgres kicsit később áll fel), majd lefuttatja a hiányzó migrációkat. */
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
  const applied = await migrate(pool)
  if (applied.length > 0) console.log(`[pnw] migrációk lefutottak: ${applied.join(', ')}`)
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
