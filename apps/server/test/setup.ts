/**
 * Runs once before the test files: builds a migrated template database, which every test file then copies
 * (CREATE DATABASE … TEMPLATE), so each file has a fresh, isolated database in a few milliseconds.
 */
import postgres from 'postgres'
import { migrateDb } from '../src/db/client.ts'
import { TEMPLATE_DB, TEST_DATABASE_URL, dbUrl } from './helpers.ts'

const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
await admin.unsafe(`DROP DATABASE IF EXISTS ${TEMPLATE_DB}`)
await admin.unsafe(`CREATE DATABASE ${TEMPLATE_DB}`)
await admin.end()
await migrateDb(dbUrl(TEMPLATE_DB))
