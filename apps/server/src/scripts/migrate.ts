/** Applies the pending migrations and seeds an empty database (the API does both on start too). */
import { loadConfig } from '../config.ts'
import { createDb, migrateDb } from '../db/client.ts'
import { seed } from '../lib/seed.ts'

const config = loadConfig()
await migrateDb(config.databaseUrl)
const { db, sql } = createDb(config.databaseUrl)
await seed(db, config.seedPassword)
await sql.end()
console.log('[petrik] database is up to date')
