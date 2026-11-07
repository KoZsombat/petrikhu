/**
 * Starts the API: checks the production safeguards, migrates and seeds the database, starts the scheduled-post
 * sweep and listens. WARNING: a single instance is assumed (the sweep and the rate limits live in this process).
 */
import { eq } from 'drizzle-orm'
import { passwordProblem, usernameSchema } from '@petrik/shared/schemas'
import { IS_PRODUCTION, DEV_SECRET, SCHEDULE_CHECK_MS, loadConfig } from './config.ts'
import { createApp, createDeps } from './app.ts'
import { createDb, migrateDb } from './db/client.ts'
import { users } from './db/schema.ts'
import { verifyPassword } from './lib/auth.ts'
import { DEMO_USERS, seed } from './lib/seed.ts'
import { passwordHashOf, setPassword } from './lib/users.ts'
import { sweepScheduledPosts } from './routes/posts.ts'

const config = loadConfig()

if (IS_PRODUCTION && (config.secret === DEV_SECRET || config.secret.length < 32)) {
  console.error('[petrik] PNW_SESSION_SECRET is missing or shorter than 32 characters - refusing to start in production.')
  process.exit(1)
}

if (IS_PRODUCTION && config.seedPassword && passwordProblem(config.seedPassword)) {
  console.error('[petrik] PNW_SEED_PASSWORD is shorter than the minimum password length (10) - refusing to start in production.')
  process.exit(1)
}
if (IS_PRODUCTION && !usernameSchema.safeParse(config.adminUsername).success) {
  console.error('[petrik] PNW_ADMIN_USERNAME is not a valid username (letters, digits, . _ -; 2-60 characters) - refusing to start in production.')
  process.exit(1)
}

await migrateDb(config.databaseUrl)
const { db, sql } = createDb(config.databaseUrl)

// In production no account may keep a public demo password: replaced with PNW_SEED_PASSWORD, or refuse to start.
if (IS_PRODUCTION) {
  const affected: string[] = []
  for (const demo of DEMO_USERS) {
    const user = (await db.select({ id: users.id }).from(users).where(eq(users.username, demo.username)).limit(1))[0]
    const hash = user && (await passwordHashOf(db, user.id))
    if (!user || !hash || !(await verifyPassword(demo.password, hash))) continue
    affected.push(demo.username)
    // The shared seed password is only a starting point: the account must change it at its next login.
    if (config.seedPassword) await setPassword(db, user.id, config.seedPassword, { mustChange: true })
  }
  if (affected.length && !config.seedPassword) {
    console.error(`[petrik] These accounts still have the public demo password: ${affected.join(', ')}. Set PNW_SEED_PASSWORD - refusing to start in production.`)
    process.exit(1)
  }
  if (affected.length) console.log(`[petrik] demo passwords replaced with PNW_SEED_PASSWORD: ${affected.join(', ')}`)
  // An empty database gets a single admin with PNW_SEED_PASSWORD (no demo accounts in production).
  if (!config.seedPassword && (await db.select({ id: users.id }).from(users).limit(1)).length === 0) {
    console.error('[petrik] The database has no accounts and PNW_SEED_PASSWORD is not set - refusing to start: the first admin needs an initial password in production.')
    process.exit(1)
  }
}

await seed(db, config.seedPassword, { production: IS_PRODUCTION, adminUsername: config.adminUsername })

const app = createApp(createDeps(db, config))

setInterval(() => {
  sweepScheduledPosts(db).catch((error) => console.error('[petrik] scheduled-publish sweep failed', error))
}, SCHEDULE_CHECK_MS)

const server = Bun.serve({ port: config.port, fetch: app.fetch, maxRequestBodySize: 16 * 1024 * 1024 })
console.log(`[petrik] API listening on http://localhost:${server.port}`)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    await server.stop()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}
