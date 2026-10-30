// 1.2: RESERVED_SLUGS must not drift from the routes in src/App.tsx.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RESERVED_SLUGS } from '../shared/pnw/creator-types.ts'

const root = new URL('..', import.meta.url)
const appSource = readFileSync(new URL('src/App.tsx', root), 'utf8')
const builtInSlugs = Object.keys(JSON.parse(readFileSync(new URL('src/pages/samples/pages.json', root), 'utf8')))

/** Fixed routes that a published page with the same slug deliberately overrides (not reserved). */
const OVERRIDABLE = new Set([...builtInSlugs, 'dokumentumtar'])

/** The first, non-parameter segment of every `path="/something..."` route in App.tsx. */
function fixedTopSegments(source: string): string[] {
  const segments = new Set<string>()
  for (const match of source.matchAll(/path=\{?["'`]\/([^"'`/]+)/g)) {
    const segment = match[1]
    if (!segment.startsWith(':') && segment !== '*' && !segment.includes('$')) segments.add(segment)
  }
  return [...segments]
}

test('every fixed route in App.tsx is either reserved or overridable', () => {
  const segments = fixedTopSegments(appSource)
  assert.ok(segments.length >= 8, `found too few routes: ${segments.join(', ')}`)
  const missing = segments.filter((segment) => !RESERVED_SLUGS.includes(segment) && !OVERRIDABLE.has(segment))
  assert.deepEqual(missing, [], `missing from RESERVED_SLUGS: ${missing.join(', ')}`)
})

test('the overridable routes are not reserved', () => {
  const clash = RESERVED_SLUGS.filter((slug) => OVERRIDABLE.has(slug))
  assert.deepEqual(clash, [])
})

test('the server\'s own routes are reserved', () => {
  for (const slug of ['api', 'uploads', 'media', 'healthz']) assert.ok(RESERVED_SLUGS.includes(slug), slug)
})
