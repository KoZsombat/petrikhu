// 1.2: a RESERVED_SLUGS nem csúszhat el az src/App.tsx útvonalaitól.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RESERVED_SLUGS } from '../shared/pnw/creator-types.ts'

const root = new URL('..', import.meta.url)
const appSource = readFileSync(new URL('src/App.tsx', root), 'utf8')
const builtInSlugs = Object.keys(JSON.parse(readFileSync(new URL('src/pages/samples/pages.json', root), 'utf8')))

/** Rögzített útvonalak, amelyeket egy kiadott, azonos slugú oldal szándékosan felülír (nem foglaltak). */
const OVERRIDABLE = new Set([...builtInSlugs, 'dokumentumtar'])

/** Az App.tsx minden `path="/valami..."` útvonalának első, nem paraméteres szakasza. */
function fixedTopSegments(source: string): string[] {
  const segments = new Set<string>()
  for (const match of source.matchAll(/path=\{?["'`]\/([^"'`/]+)/g)) {
    const segment = match[1]
    if (!segment.startsWith(':') && segment !== '*' && !segment.includes('$')) segments.add(segment)
  }
  return [...segments]
}

test('az App.tsx minden rögzített útvonala foglalt vagy felülírható', () => {
  const segments = fixedTopSegments(appSource)
  assert.ok(segments.length >= 8, `túl kevés útvonalat talált: ${segments.join(', ')}`)
  const missing = segments.filter((segment) => !RESERVED_SLUGS.includes(segment) && !OVERRIDABLE.has(segment))
  assert.deepEqual(missing, [], `hiányzik a RESERVED_SLUGS-ból: ${missing.join(', ')}`)
})

test('a felülírható útvonalak nem foglaltak', () => {
  const clash = RESERVED_SLUGS.filter((slug) => OVERRIDABLE.has(slug))
  assert.deepEqual(clash, [])
})

test('a szerver saját útvonalai foglaltak', () => {
  for (const slug of ['api', 'uploads', 'media', 'healthz']) assert.ok(RESERVED_SLUGS.includes(slug), slug)
})
