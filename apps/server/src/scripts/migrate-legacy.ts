/**
 * Copies the old app's database into the new schema.
 *   LEGACY_DATABASE_URL=postgres://…/petrik  DATABASE_URL=postgres://…/petrik_new  bun run migrate:legacy [--no-media]
 * The target is migrated first. Safe to run again. Prints a report (role mapping, renamed pages, issues).
 */
import postgres from 'postgres'
import { createDb, migrateDb } from '../db/client.ts'
import { migrateLegacy } from '../lib/legacy-migration.ts'

const legacyUrl = process.env.LEGACY_DATABASE_URL
const targetUrl = process.env.DATABASE_URL
if (!legacyUrl || !targetUrl) {
  console.error('Set LEGACY_DATABASE_URL (the old database) and DATABASE_URL (the new one).')
  process.exit(1)
}
if (legacyUrl === targetUrl) {
  console.error('LEGACY_DATABASE_URL and DATABASE_URL must be different databases.')
  process.exit(1)
}

await migrateDb(targetUrl)
const old = postgres(legacyUrl, { max: 2, onnotice: () => {} })
const { db, sql } = createDb(targetUrl)
try {
  const report = await migrateLegacy(old, db, { media: !process.argv.includes('--no-media'), log: (line) => console.log(`[migrate] ${line}`) })
  console.log('\nAccounts (old permissions → new role):')
  for (const user of report.users) console.log(`  ${user.username.padEnd(24)} ${user.role.padEnd(9)} ← ${user.permissions.join(', ') || '(none)'}`)
  console.log('\nCounts:', JSON.stringify(report.counts, null, 2))
  if (report.renamedPages.length) console.log('\nRenamed pages:\n  ' + report.renamedPages.join('\n  '))
  if (report.issues.length) console.log('\nIssues:\n  ' + report.issues.join('\n  '))
  console.log('\nDone. Sessions were not copied: everyone logs in again.')
} finally {
  await old.end()
  await sql.end()
}
