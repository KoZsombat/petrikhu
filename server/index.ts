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

// Élesben nem indulhat el a repóból ismert titokkal: a munkamenet-aláírás és a demó-fiókok jelszava nyilvános lenne.
if (IS_PRODUCTION && USING_DEFAULT_SECRET) {
  console.error('[pnw] PNW_SESSION_SECRET nincs beállítva (lásd .env.example) - éles módban nem indulok el.')
  process.exit(1)
}

await initDb()

if (IS_PRODUCTION) {
  const affected = await replaceDemoPasswords(SEED_PASSWORD)
  if (affected.length > 0 && !SEED_PASSWORD) {
    console.error(`[pnw] Ezeknek a fiókoknak még a nyilvános demó-jelszó van beállítva: ${affected.join(', ')}. Állítsd be a PNW_SEED_PASSWORD-öt, és újraindításkor lecserélem - éles módban nem indulok el.`)
    process.exit(1)
  }
  if (affected.length > 0) console.log(`[pnw] A demó-jelszavak lecserélve a PNW_SEED_PASSWORD-re: ${affected.join(', ')}`)
}

await seedInitialUsers()
await seedInitialTerms()

// Media lives in the database; copy in whatever the folders still hold (once - see lib/media.ts).
for (const [dir, prefix] of [[UPLOADS_DIR, UPLOADS_URL_PREFIX], [MEDIA_SEED_DIR, MEDIA_URL_PREFIX]] as const) {
  const added = await importDirectory(dir, prefix)
  if (added > 0) console.log(`[pnw] imported ${added} files from ${dir} into the database`)
}

const app = createApp()

// FIGYELEM: egyetlen példányt feltételez. Két replikán mindkettő lefuttatná a söprést, és egy időzített hír
// kétszer jelenne meg (kétszeres napló, kétszeres értesítés). Több példányhoz adatbázis-zár (pl.
// pg_try_advisory_lock) vagy külön ütemező kellene - jelenleg szándékosan nincs.
setInterval(() => {
  sweepScheduledPosts().catch((error) => console.error('[pnw] scheduled-publish sweep failed', error))
}, SCHEDULE_CHECK_INTERVAL_MS)

const server = app.listen(PORT, () => {
  console.log(`[pnw] Hírkezelő backend listening on http://localhost:${PORT}`)
})

// A Docker leállításkor (SIGTERM) a folyamatban lévő kérések befejeződnek, és az adatbázis rendben záródik.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
