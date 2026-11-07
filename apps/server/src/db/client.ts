import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { resolve } from 'node:path'
import postgres from 'postgres'
import * as schema from './schema.ts'

export type Db = ReturnType<typeof createDb>['db']

export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => {} })
  const db = drizzle(sql, { schema })
  return { db, sql }
}

export const MIGRATIONS_DIR = resolve(import.meta.dir, '../../drizzle')

/** Waits for the database (compose starts Postgres a little later), then applies the missing migrations. */
export async function migrateDb(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await sql`SELECT 1`
        break
      } catch (error) {
        if (attempt >= 30) throw error
        console.log(`[petrik] waiting for PostgreSQL (${attempt}/30)…`)
        await Bun.sleep(2000)
      }
    }
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR })
  } finally {
    await sql.end()
  }
}
