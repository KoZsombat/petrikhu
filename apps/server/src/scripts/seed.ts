/** Seeds an empty database: demo accounts, categories, the built-in pages, menus and library (idempotent). */
import { loadConfig } from '../config.ts'
import { createDb, migrateDb } from '../db/client.ts'
import { seed } from '../lib/seed.ts'

const config = loadConfig()
await migrateDb(config.databaseUrl)
const { db, sql } = createDb(config.databaseUrl)
await seed(db, config.seedPassword)
await sql.end()
console.log('[petrik] database is up to date')
