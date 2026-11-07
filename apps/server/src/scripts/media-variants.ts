/**
 * One-time: makes every missing WebP / AVIF variant of the images already in the database (e.g. the old site's
 * files after `media:import`), so no visitor's request has to wait for an encode. Safe to run again.
 *   bun run media:variants
 */
import { loadConfig } from '../config.ts'
import { createDb, migrateDb } from '../db/client.ts'
import { generateMissingVariants } from '../lib/media.ts'

const config = loadConfig()
await migrateDb(config.databaseUrl)
const { db, sql } = createDb(config.databaseUrl)
const started = Date.now()
const made = await generateMissingVariants(db, (line) => console.warn(`[media:variants] ${line}`))
console.log(`[media:variants] ${made} variants made in ${Math.round((Date.now() - started) / 1000)} s`)
await sql.end()
