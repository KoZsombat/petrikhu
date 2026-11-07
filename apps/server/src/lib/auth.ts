/**
 * Better Auth: username + password login and sessions stored in Postgres. Its HTTP handler is not mounted:
 * the API's own routes (routes/auth.ts) call `auth.api.*`, so the rate limits, the same-origin check and the
 * error format stay ours, and nothing else (sign-up, e-mail flows) is reachable.
 *
 * Passwords: argon2id through Bun's native, asynchronous `Bun.password`, with one fixed cost. Better Auth
 * hashes the submitted password when the username does not exist, with the same function, so the response
 * time does not reveal whether an account exists. Accounts imported from the old app keep their bcrypt hash
 * until their next successful login, which re-hashes it (routes/auth.ts).
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import type { Config } from '../config.ts'
import type { Db } from '../db/client.ts'
import * as schema from '../db/schema.ts'

const ARGON = { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 } as const

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, ARGON)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash).catch(() => false)
}

/** A hash made with an older algorithm or cost: re-hash it on the next successful login. */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith(`$argon2id$v=19$m=${ARGON.memoryCost},t=${ARGON.timeCost},`)
}

export const SESSION_DAYS = 7

export function createAuth(db: Db, config: Config) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications },
    }),
    secret: config.secret,
    baseURL: config.publicUrl || 'http://localhost:4000',
    trustedOrigins: config.allowedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 200,
      password: { hash: hashPassword, verify: ({ hash, password }) => verifyPassword(password, hash) },
    },
    plugins: [
      username({
        minUsernameLength: 2,
        maxUsernameLength: 60,
        usernameValidator: (value) => /^[a-zA-Z0-9._-]+$/.test(value),
      }),
    ],
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'author', input: false },
        mustChangePassword: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },
    session: { expiresIn: SESSION_DAYS * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    logger: { level: 'error' },
    advanced: {
      cookiePrefix: 'petrik',
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      database: { generateId: () => crypto.randomUUID() },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
