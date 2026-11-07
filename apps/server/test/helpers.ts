/**
 * Integration test helpers: a fresh database per test file (copied from the migrated template, see setup.ts),
 * the real app on a random port, and a small HTTP client with its own cookie jar.
 */
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { createApp, createDeps } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { Config } from '../src/config.ts'
import { createDb } from '../src/db/client.ts'
import type { Db } from '../src/db/client.ts'
import { documents, users } from '../src/db/schema.ts'
import { seed, seedTerms, seedUsers } from '../src/lib/seed.ts'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://petrik:petrik@localhost:5432/petrik_test'
export const TEMPLATE_DB = `${new URL(TEST_DATABASE_URL).pathname.slice(1)}_template`

export function dbUrl(name: string): string {
  const url = new URL(TEST_DATABASE_URL)
  url.pathname = `/${name}`
  return url.toString()
}

/** The demo accounts seeded into a fresh database (src/lib/seed.ts). */
export const DEMO = {
  author: { username: 'mk.vezeto', password: 'PetrikMK2026!' },
  reviewer: { username: 'helyettes', password: 'PetrikHelyettes2026!' },
  admin: { username: 'igazgato', password: 'PetrikIgazgato2026!' },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read arbitrary JSON
export type Res = { status: number; headers: Headers; body: any; text: string }

export class Client {
  cookies = new Map<string, string>()
  constructor(
    private base: string,
    private defaultHeaders: Record<string, string> = {},
  ) {}

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
    const init: RequestInit = { method, headers: { ...this.defaultHeaders, ...headers }, redirect: 'manual' }
    const h = init.headers as Record<string, string>
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    if (body instanceof FormData) init.body = body
    else if (typeof body === 'string') {
      h['content-type'] ??= 'application/json'
      init.body = body
    } else if (body !== undefined) {
      h['content-type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(this.base + path, init)
    for (const cookie of res.headers.getSetCookie()) {
      const [pair, ...attrs] = cookie.split(';')
      const [name, ...value] = pair.split('=')
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()))
      if (expired || value.join('=') === '') this.cookies.delete(name.trim())
      else this.cookies.set(name.trim(), value.join('='))
    }
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // not JSON (media)
    }
    return { status: res.status, headers: res.headers, body: parsed, text }
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request('GET', path, undefined, headers)
  }
  post(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request('POST', path, body, headers)
  }
  put(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request('PUT', path, body, headers)
  }
  delete(path: string, headers?: Record<string, string>) {
    return this.request('DELETE', path, undefined, headers)
  }
}

/** The tests' stand-in for Cloudflare's header. */
export const TEST_IP_HEADER = 'cf-connecting-ip'

export const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`

export type TestServer = {
  url: string
  db: Db
  config: Config
  sql: postgres.Sql
  client: (headers?: Record<string, string>) => Client
  login: (credentials: { username: string; password: string }, headers?: Record<string, string>) => Promise<Client>
  /** A save body with the document's current version (what the admin sends; optimistic concurrency). */
  versioned: <T extends object>(id: string, body: T) => Promise<T & { version: number }>
  close: () => Promise<void>
}

/**
 * Starts the app on a new database. `content: true` also seeds the built-in pages, menus and library
 * (otherwise only the demo accounts and the categories).
 */
export async function startTestServer(options: { content?: boolean; config?: Partial<Config>; keepPasswordChange?: boolean } = {}): Promise<TestServer> {
  const name = `t_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
  await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`)
  const { db, sql } = createDb(dbUrl(name), { max: 5 })
  if (options.content) await seed(db)
  else {
    await seedUsers(db)
    await seedTerms(db)
  }
  const config = loadConfig({ databaseUrl: dbUrl(name), clientIpHeader: TEST_IP_HEADER, trustProxy: 0, allowedOrigins: [], publicUrl: '', secureCookies: false, ...options.config })
  const app = createApp(createDeps(db, config))
  const server = Bun.serve({ port: 0, fetch: app.fetch })
  const url = `http://127.0.0.1:${server.port}`
  // Every client gets its own IP (in the configured client-IP header), unless the test gives one, so the per-IP
  // limits do not add up across tests.
  const client = (headers?: Record<string, string>) => new Client(url, { [TEST_IP_HEADER]: randomIp(), ...headers })
  return {
    url,
    db,
    config,
    sql,
    client,
    async login(credentials, headers) {
      const c = client(headers)
      const res = await c.post('/api/auth/login', credentials)
      if (res.status !== 200) throw new Error(`login failed for ${credentials.username}: ${res.status} ${res.text}`)
      // Accounts created by an admin must change their password first; tests about something else skip that
      // (test/api/password-change.test.ts covers it).
      if (res.body.user.mustChangePassword && !options.keepPasswordChange) await db.update(users).set({ mustChangePassword: false }).where(eq(users.id, res.body.user.id))
      return c
    },
    async versioned(id, body) {
      const row = /^[0-9a-f-]{36}$/.test(id) ? (await db.select({ version: documents.version }).from(documents).where(eq(documents.id, id)))[0] : undefined
      return { ...body, version: row?.version ?? 1 }
    },
    async close() {
      await server.stop(true)
      await sql.end()
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await admin.end()
    },
  }
}

/** A file to upload, as multipart form data. */
export function fileForm(name: string, bytes: Uint8Array | string, type = 'application/octet-stream', field = 'file'): FormData {
  const form = new FormData()
  form.append(field, new Blob([typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)], { type }), name)
  return form
}

/** A real 1×1 PNG. */
export const PNG_BYTES = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

export const doc = (...paragraphs: string[]) => ({
  type: 'doc' as const,
  content: paragraphs.map((text) => ({ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] })),
})
