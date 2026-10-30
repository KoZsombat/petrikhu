/**
 * The PostgreSQL database of the Hírkezelő / Szerkesztő. The connection comes from `DATABASE_URL`; the schema is
 * created and updated on startup by the versioned migrations (data/migrate.ts, data/migrations/).
 *
 * JSON columns (blocks, content, permissions...) are stored as text, as before: validation happens on
 * input (server/lib/validation.ts), and the repos JSON.parse them.
 */
import pg from 'pg'
import { DATABASE_URL } from '../config.ts'
import { migrate } from './migrate.ts'

// BIGINT (20) and NUMERIC come back as strings by default: the session expiry is in ms and fits into a Number.
pg.types.setTypeParser(20, (value) => Number(value))
// TIMESTAMPTZ (1184): the application works with UTC ISO strings everywhere (toISOString()), and the API returns them too.
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString())

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
pool.on('error', (error) => console.error('[pnw] postgres pool error', error))

export type Queryable = Pick<pg.Pool, 'query'>

/** One query; returns the rows. */
export async function rows<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[]
}

export async function row<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(text, params))[0]
}

/** INSERT/UPDATE/DELETE: the number of affected rows. */
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


/** Once on startup: waits for the database (under compose, Postgres comes up a bit later), then runs the missing migrations. */
export async function initDb(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (error) {
      if (attempt >= 30) throw error
      console.log(`[pnw] waiting for PostgreSQL (${attempt}/30)...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  const applied = await migrate(pool)
  if (applied.length > 0) console.log(`[pnw] migrations applied: ${applied.join(', ')}`)
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
