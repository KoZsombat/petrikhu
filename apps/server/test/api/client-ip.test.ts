/** Which IP the rate limits key on: never something the visitor can choose (X-Forwarded-For). */
import { afterAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { loadConfig } from '../../src/config.ts'
import type { Config } from '../../src/config.ts'
import { clientIp } from '../../src/lib/security.ts'
import { startTestServer } from '../helpers.ts'
import type { TestServer } from '../helpers.ts'

/** What clientIp returns for these headers, with the socket peer 172.18.0.5 (the Next.js container). */
async function ipFor(config: Partial<Config>, headers: Record<string, string>): Promise<string> {
  const app = new Hono()
  app.get('/', (c) => c.text(clientIp(c, loadConfig(config), '172.18.0.5')))
  return (await app.request('/', { headers })).text()
}

describe('clientIp', () => {
  test('without a configured header: the socket peer, whatever X-Forwarded-For says', async () => {
    expect(await ipFor({ clientIpHeader: undefined, trustProxy: 0 }, { 'x-forwarded-for': '10.0.0.1, 1.2.3.4' })).toBe('172.18.0.5')
    expect(await ipFor({ clientIpHeader: undefined, trustProxy: 0 }, {})).toBe('172.18.0.5')
  })

  test('with a configured header: its value; a spoofed X-Forwarded-For changes nothing', async () => {
    const config = { clientIpHeader: 'cf-connecting-ip', trustProxy: 0 }
    expect(await ipFor(config, { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.1' })).toBe('203.0.113.7')
    expect(await ipFor(config, { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.2' })).toBe('203.0.113.7')
    // Missing (a request that did not come through the edge): the peer, not X-Forwarded-For.
    expect(await ipFor(config, { 'x-forwarded-for': '10.0.0.1' })).toBe('172.18.0.5')
  })

  test('hop counting (opt-in) never falls back to the left-most entry', async () => {
    expect(await ipFor({ clientIpHeader: undefined, trustProxy: 1 }, { 'x-forwarded-for': '10.0.0.1, 198.51.100.4' })).toBe('198.51.100.4')
    // Fewer hops than trusted proxies: the peer, not the visitor-supplied 10.0.0.1.
    expect(await ipFor({ clientIpHeader: undefined, trustProxy: 3 }, { 'x-forwarded-for': '10.0.0.1' })).toBe('172.18.0.5')
  })

  test('PNW_CLIENT_IP_HEADER / PNW_TRUST_PROXY: hop counting is off by default', () => {
    const before = { header: process.env.PNW_CLIENT_IP_HEADER, hops: process.env.PNW_TRUST_PROXY }
    delete process.env.PNW_CLIENT_IP_HEADER
    delete process.env.PNW_TRUST_PROXY
    expect(loadConfig()).toMatchObject({ clientIpHeader: undefined, trustProxy: 0 })
    process.env.PNW_CLIENT_IP_HEADER = 'CF-Connecting-IP'
    expect(loadConfig().clientIpHeader).toBe('cf-connecting-ip')
    if (before.header === undefined) delete process.env.PNW_CLIENT_IP_HEADER
    else process.env.PNW_CLIENT_IP_HEADER = before.header
    if (before.hops !== undefined) process.env.PNW_TRUST_PROXY = before.hops
  })
})

describe('the login limit cannot be bypassed with X-Forwarded-For', () => {
  let s: TestServer
  afterAll(() => s?.close())

  test('a different spoofed X-Forwarded-For on every attempt still hits the limit after 8', async () => {
    s = await startTestServer({ config: { clientIpHeader: 'cf-connecting-ip' } })
    const statuses: number[] = []
    for (let i = 0; i < 12; i += 1) {
      const client = s.client({ 'cf-connecting-ip': '198.51.100.20', 'x-forwarded-for': `10.0.0.${i}, 1.2.3.4` })
      statuses.push((await client.post('/api/auth/login', { username: 'helyettes', password: 'wrong-password-1' })).status)
    }
    expect(statuses.slice(0, 8).every((status) => status === 401)).toBe(true)
    expect(statuses.slice(8).every((status) => status === 429)).toBe(true)
  })

  test('the configured header is the key: another client IP is not locked out', async () => {
    const res = await s.client({ 'cf-connecting-ip': '198.51.100.21' }).post('/api/auth/login', { username: 'helyettes', password: 'PetrikHelyettes2026!' })
    expect(res.status).toBe(200)
  })
})
