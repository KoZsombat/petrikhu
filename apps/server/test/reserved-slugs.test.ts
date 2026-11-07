/**
 * Every fixed route of the public site (a folder under apps/client/app that is not a dynamic segment or a
 * route group) must be a reserved slug, or a Creator page with that slug would never be reachable.
 */
import { expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { RESERVED_SLUGS } from '@petrik/shared/slug'

const APP = resolve(import.meta.dir, '../../client/app')

function topLevelRoutes(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'fonts' || entry.name.startsWith('[') || entry.name.startsWith('_')) continue
    if (entry.name.startsWith('(')) out.push(...topLevelRoutes(resolve(dir, entry.name)))
    else out.push(entry.name)
  }
  return out
}

test('every fixed top-level route of the site is a reserved slug', () => {
  const routes = topLevelRoutes(APP)
  expect(routes.length).toBeGreaterThan(3)
  for (const route of routes) expect({ route, reserved: (RESERVED_SLUGS as readonly string[]).includes(route) }).toEqual({ route, reserved: true })
})

test('the paths the API and the proxy own are reserved too', () => {
  for (const slug of ['api', 'uploads', 'media', 'admin', 'healthz', '_next']) expect(RESERVED_SLUGS as readonly string[]).toContain(slug)
})
