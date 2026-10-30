/**
 * Integration test helper: every test file (a separate process under `node --test`) gets its own randomly named
 * PostgreSQL schema in the `TEST_DATABASE_URL` database, so the files can run in parallel. The schema is dropped at the end
 * is dropped. The server modules are only loaded after `DATABASE_URL` is set (dynamic import), because the
 * connection is created when config.ts loads.
 */
import type { AddressInfo } from 'node:net'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://petrik:petrik@localhost:5432/petrik_test'

/** The demo accounts of seedInitialUsers() (server/data/users-repo.ts). */
export const DEMO = {
  author: { login: 'mk.vezeto', password: 'PetrikMK2026!' },
  reviewer: { login: 'helyettes', password: 'PetrikHelyettes2026!' },
  director: { login: 'igazgato', password: 'PetrikIgazgato2026!' },
} as const

export type TestServer = {
  url: string
  schema: string
  /** A new client with its own cookie jar (one browser). */
  client: () => Client
  /** A logged-in client; throws if the login fails. */
  login: (credentials: { login: string; password: string }) => Promise<Client>
  /** Direct SQL in the test schema (for setup and checks). */
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>
  close: () => Promise<void>
}

export type Response = { status: number; headers: Headers; body: unknown; text: string }

export class Client {
  cookie = ''
  private base: string
  constructor(base: string) {
    this.base = base
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    const init: RequestInit = { method, headers: { ...headers }, redirect: 'manual' }
    if (this.cookie) (init.headers as Record<string, string>).cookie = this.cookie
    if (body instanceof FormData) init.body = body
    else if (body !== undefined) {
      ;(init.headers as Record<string, string>)['content-type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(this.base + path, init)
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) this.cookie = setCookie.split(';')[0]
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // not JSON (e.g. media) - stays as text
    }
    return { status: res.status, headers: res.headers, body: parsed, text }
  }

  get(path: string) {
    return this.request('GET', path)
  }
  post(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request('POST', path, body, headers)
  }
  put(path: string, body?: unknown) {
    return this.request('PUT', path, body)
  }
  delete(path: string) {
    return this.request('DELETE', path)
  }
}

/** Starts the application on a fresh schema, with the demo accounts and categories. */
export async function startTestServer(): Promise<TestServer> {
  const schema = `t_${randomBytes(6).toString('hex')}`
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await admin.connect()
  await admin.query(`CREATE SCHEMA ${schema}`)
  await admin.end()

  const url = new URL(TEST_DATABASE_URL)
  url.searchParams.set('options', `-c search_path=${schema}`)
  process.env.DATABASE_URL = url.toString()

  const db = await import('../../server/data/db.ts')
  const users = await import('../../server/data/users-repo.ts')
  const terms = await import('../../server/data/terms-repo.ts')
  const { createApp } = await import('../../server/app.ts')

  await db.initDb()
  await users.seedInitialUsers()
  await terms.seedInitialTerms()

  const server = createApp().listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const client = () => new Client(base)
  return {
    url: base,
    schema,
    client,
    async login(credentials) {
      const c = client()
      const res = await c.post('/api/auth/login', credentials)
      if (res.status !== 200) throw new Error(`login failed for ${credentials.login}: ${res.status} ${res.text}`)
      return c
    },
    sql: (text, params) => db.rows(text, params),
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await db.closeDb()
      const cleanup = new pg.Client({ connectionString: TEST_DATABASE_URL })
      await cleanup.connect()
      await cleanup.query(`DROP SCHEMA ${schema} CASCADE`)
      await cleanup.end()
    },
  }
}

/** A file to upload, in FormData. */
export function fileForm(field: string, name: string, bytes: Uint8Array | string, type = 'application/octet-stream', extra: Record<string, string> = {}): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  form.append(field, new Blob([typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes], { type }), name)
  return form
}

/** The header of a real (1×1) PNG - enough for the magic-byte check. */
export const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52])
