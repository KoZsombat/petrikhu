/**
 * The /hirkezelo/ backend's entry point - see "Server" in AGENTS.md for what
 * it serves. The app itself is built in app.ts (so the tests can start it
 * without a port); this file only boots the database, seeds and listens.
 *
 * Run it with `npm run server` (= `node --experimental-strip-types server/index.ts`)
 * - no separate build step.
 */
import {
  IS_PRODUCTION,
  PORT,
  SCHEDULE_CHECK_INTERVAL_MS,
  SEED_PASSWORD,
  MEDIA_SEED_DIR,
  MEDIA_URL_PREFIX,
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
  USING_DEFAULT_SECRET,
} from './config.ts'
import { closeDb, initDb } from './data/db.ts'
import { replaceDemoPasswords, seedInitialUsers } from './data/users-repo.ts'
import { seedInitialTerms } from './data/terms-repo.ts'
import { importDirectory } from './lib/media.ts'
import { createApp, sweepScheduledPosts } from './app.ts'

// In production it must not start with a secret known from the repo: the session signing key and the demo-account passwords would be public.
if (IS_PRODUCTION && USING_DEFAULT_SECRET) {
  console.error('[pnw] PNW_SESSION_SECRET is not set (see .env.example) - refusing to start in production mode.')
  process.exit(1)
}

await initDb()

if (IS_PRODUCTION) {
  const affected = await replaceDemoPasswords(SEED_PASSWORD)
  if (affected.length > 0 && !SEED_PASSWORD) {
    console.error(`[pnw] These accounts still have the public demo password: ${affected.join(', ')}. Set PNW_SEED_PASSWORD and I will replace them on startup - refusing to start in production mode.`)
    process.exit(1)
  }
  if (affected.length > 0) console.log(`[pnw] Demo passwords replaced with PNW_SEED_PASSWORD: ${affected.join(', ')}`)
}

await seedInitialUsers()
await seedInitialTerms()

// Media lives in the database; copy in whatever the folders still hold (once - see lib/media.ts).
for (const [dir, prefix] of [[UPLOADS_DIR, UPLOADS_URL_PREFIX], [MEDIA_SEED_DIR, MEDIA_URL_PREFIX]] as const) {
  const added = await importDirectory(dir, prefix)
  if (added > 0) console.log(`[pnw] imported ${added} files from ${dir} into the database`)
}

const app = createApp()

// WARNING: assumes a single instance. With two replicas both would run the sweep, and a scheduled post
// would be published twice (duplicate log entries and notifications). For several instances a database lock (e.g.
// pg_try_advisory_lock) or a separate scheduler would be needed - currently deliberately absent.
setInterval(() => {
  sweepScheduledPosts().catch((error) => console.error('[pnw] scheduled-publish sweep failed', error))
}, SCHEDULE_CHECK_INTERVAL_MS)

const server = app.listen(PORT, () => {
  console.log(`[pnw] Hírkezelő backend listening on http://localhost:${PORT}`)
})

// On Docker shutdown (SIGTERM) in-flight requests finish and the database closes cleanly.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
