/** Per-account backoff across IPs: distributed guessing slows down; never a permanent lock. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { AccountBackoff } from '../../src/lib/security.ts'
import { DEMO, randomIp, startTestServer, TEST_IP_HEADER } from '../helpers.ts'
import type { TestServer } from '../helpers.ts'

describe('AccountBackoff', () => {
  const options = { threshold: 10, baseMs: 2_000, maxMs: 15 * 60 * 1000, forgetMs: 60 * 60 * 1000 }

  test('free for 10 failures, then 2 s, 4 s, 8 s … capped at 15 minutes', () => {
    let now = 0
    const backoff = new AccountBackoff(options, () => now)
    for (let i = 0; i < 10; i += 1) {
      expect(backoff.waitMs('a')).toBe(0)
      backoff.fail('a')
    }
    expect(backoff.waitMs('a')).toBe(2_000)
    now += 2_000
    expect(backoff.waitMs('a')).toBe(0)
    backoff.fail('a')
    expect(backoff.waitMs('a')).toBe(4_000)
    for (let i = 0; i < 20; i += 1) {
      now += backoff.waitMs('a')
      backoff.fail('a')
    }
    expect(backoff.waitMs('a')).toBe(15 * 60 * 1000)
    // Other accounts are not affected.
    expect(backoff.waitMs('b')).toBe(0)
  })

  test('never permanent: after the wait an attempt is allowed; an hour of quiet forgets it', () => {
    let now = 0
    const backoff = new AccountBackoff(options, () => now)
    for (let i = 0; i < 40; i += 1) {
      now += backoff.waitMs('a')
      backoff.fail('a')
    }
    now += 15 * 60 * 1000
    expect(backoff.waitMs('a')).toBe(0)
    now += 60 * 60 * 1000
    backoff.fail('a')
    expect(backoff.waitMs('a')).toBe(0)
  })

  test('a successful login resets it', () => {
    const now = 0
    const backoff = new AccountBackoff(options, () => now)
    for (let i = 0; i < 12; i += 1) backoff.fail('a')
    expect(backoff.waitMs('a')).toBeGreaterThan(0)
    backoff.reset('a')
    expect(backoff.waitMs('a')).toBe(0)
  })
})

describe('login', () => {
  let s: TestServer
  beforeAll(async () => {
    s = await startTestServer()
  })
  afterAll(() => s.close())

  const attempt = (username: string, password = 'wrong-password-1') => s.client({ [TEST_IP_HEADER]: randomIp() }).post('/api/auth/login', { username, password })

  test('10 failures from 10 different IPs: the next attempt from yet another IP waits, even with the right password', async () => {
    for (let i = 0; i < 10; i += 1) expect((await attempt('helyettes')).status).toBe(401)
    const blocked = await attempt('helyettes', DEMO.reviewer.password)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
    expect(Number(blocked.headers.get('retry-after'))).toBeLessThanOrEqual(2)
    // The username is matched case-insensitively.
    expect((await attempt('HELYETTES')).status).toBe(429)
    // Another account is not affected.
    expect((await attempt('igazgato', DEMO.admin.password)).status).toBe(200)
  })

  test('after the wait, the right password logs in and resets the backoff', async () => {
    await Bun.sleep(2_100)
    expect((await attempt('helyettes', DEMO.reviewer.password)).status).toBe(200)
    expect((await attempt('helyettes')).status).toBe(401)
    expect((await attempt('helyettes', DEMO.reviewer.password)).status).toBe(200)
  })

  test('an unknown username behaves the same (nothing reveals whether the account exists)', async () => {
    for (let i = 0; i < 10; i += 1) expect((await attempt('senki.ilyen')).status).toBe(401)
    const blocked = await attempt('senki.ilyen')
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({ error: 'too_many_attempts' })
  })
})
