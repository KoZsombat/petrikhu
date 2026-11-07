/** The production start-up guards of src/index.ts: run the real entry point and read what it says. */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { createDb } from '../src/db/client.ts'
import { seedUsers } from '../src/lib/seed.ts'
import { TEMPLATE_DB, TEST_DATABASE_URL, dbUrl } from './helpers.ts'

const name = `startup_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
const SECRET = 'a-long-enough-production-secret-0123456789'

beforeAll(async () => {
  await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`)
})
afterAll(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
  await admin.end()
})

/** Starts the API; resolves with its output once it exits or reports that it listens (then stops it). */
async function start(env: Record<string, string>): Promise<{ code: number | null; output: string }> {
  const child = Bun.spawn(['bun', resolve(import.meta.dir, '../src/index.ts')], {
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: dbUrl(name), PNW_API_PORT: String(20000 + Math.floor(Math.random() * 20000)), PNW_SEED_PASSWORD: '', PNW_SESSION_SECRET: '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  let output = ''
  const read = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      output += new TextDecoder().decode(chunk)
      if (output.includes('API listening')) child.kill()
    }
  }
  await Promise.all([read(child.stdout), read(child.stderr), child.exited])
  return { code: output.includes('API listening') ? null : child.exitCode, output }
}

test('refuses to start without a real session secret', async () => {
  const result = await start({ PNW_SEED_PASSWORD: 'SeedPassword123' })
  expect(result.code).toBe(1)
  expect(result.output).toContain('PNW_SESSION_SECRET')
})

test('refuses to seed the demo accounts with public passwords', async () => {
  const result = await start({ PNW_SESSION_SECRET: SECRET })
  expect(result.code).toBe(1)
  expect(result.output).toContain('PNW_SEED_PASSWORD')
})

test('refuses to run while an account has a demo password; replaces it when PNW_SEED_PASSWORD is set', async () => {
  const { db, sql } = createDb(dbUrl(name))
  await seedUsers(db)
  await sql.end()
  const refused = await start({ PNW_SESSION_SECRET: SECRET })
  expect(refused.code).toBe(1)
  expect(refused.output).toContain('mk.vezeto')
  const replaced = await start({ PNW_SESSION_SECRET: SECRET, PNW_SEED_PASSWORD: 'SeedPassword123' })
  expect(replaced.output).toContain('demo passwords replaced')
  expect(replaced.output).toContain('API listening')
  const again = await start({ PNW_SESSION_SECRET: SECRET })
  expect(again.output).toContain('API listening')
})
