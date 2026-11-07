/** Query strings are validated like bodies: bad numbers are 400 and never reach SQL; the public search is limited. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { DEMO, startTestServer } from '../helpers.ts'
import type { Client, TestServer } from '../helpers.ts'

let s: TestServer
let admin: Client
beforeAll(async () => {
  s = await startTestServer()
  admin = await s.login(DEMO.admin)
})
afterAll(() => s.close())

describe('public posts', () => {
  test('bad limit / offset → 400 invalid_query', async () => {
    for (const query of ['offset=Infinity', 'offset=-1', 'offset=1e3', 'offset=1.5', 'offset=1001', 'limit=0', 'limit=101', 'limit=abc', 'limit=NaN', `q=${'a'.repeat(201)}`]) {
      const res = await s.client().get(`/api/public/posts?${query}`)
      expect(res.status, query).toBe(400)
      expect(res.body.error).toBe('invalid_query')
    }
  })

  test('good values pass; empty values fall back to the defaults', async () => {
    for (const query of ['', 'limit=100&offset=1000', 'limit=&offset=', 'q=', 'category=']) expect((await s.client().get(`/api/public/posts?${query}`)).status, query).toBe(200)
  })

  test('searches (q) are limited to 60 per minute per IP; lists without q are not', async () => {
    const client = s.client()
    const statuses: number[] = []
    for (let i = 0; i < 62; i += 1) statuses.push((await client.get(`/api/public/posts?q=keres${i}`)).status)
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true)
    expect(statuses.slice(60)).toEqual([429, 429])
    expect((await client.get('/api/public/posts?limit=5')).status).toBe(200)
    // Another IP (a different visitor) still searches.
    expect((await s.client().get('/api/public/posts?q=x')).status).toBe(200)
  })

  test('the search column has a trigram index', async () => {
    const rows = await s.db.execute<{ indexdef: string }>(sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'documents_search_trgm_idx'`)
    expect(rows[0]?.indexdef).toContain('gin_trgm_ops')
  })
})

describe('admin lists', () => {
  test('posts: a missing or unknown status, a bad page → 400', async () => {
    for (const query of ['', 'status=nincs', 'status=draft&page=0', 'status=draft&page=Infinity', 'status=draft&page=-2']) {
      expect((await admin.get(`/api/posts?${query}`)).status, query).toBe(400)
    }
    expect((await admin.get('/api/posts?status=draft&page=2')).status).toBe(200)
  })

  test('pages, media and audit', async () => {
    expect((await admin.get('/api/pages?locale=de')).status).toBe(400)
    expect((await admin.get('/api/pages?locale=en')).status).toBe(200)
    expect((await admin.get('/api/media?page=0')).status).toBe(400)
    expect((await admin.get('/api/media?page=1e2')).status).toBe(400)
    expect((await admin.get('/api/media?page=2')).status).toBe(200)
    for (const query of ['limit=201', 'limit=Infinity', 'page=0', 'from=tegnap', 'to=2026-13-45', 'entityType=valami']) {
      expect((await admin.get(`/api/audit?${query}`)).status, query).toBe(400)
    }
    expect((await admin.get('/api/audit?limit=200&page=1&entityType=post&from=2026-01-01&to=2026-12-31T23:59:59')).status).toBe(200)
  })
})
