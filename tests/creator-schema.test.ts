// A közös Creator-séma (shared/pnw/creator-schema.ts) és a szerveroldali mezőellenőrzés (server/lib/creator-validation.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateBlockFields } from '../server/lib/creator-validation.ts'

type Block = { component: string; variant?: string; values: Record<string, unknown> }
const pages = (name: string) => JSON.parse(readFileSync(new URL(`../src/pages/samples/${name}`, import.meta.url), 'utf8')) as Record<string, Block[]>

for (const file of ['pages.json', 'pages.en.json']) {
  test(`a beépített ${file} minden oldala megfelel a sémának`, () => {
    const problems: string[] = []
    for (const [slug, blocks] of Object.entries(pages(file))) {
      for (const issue of validateBlockFields(blocks)) problems.push(`${slug} #${issue.block} ${blocks[issue.block]?.component} ${issue.path}: ${issue.message}`)
    }
    assert.deepEqual(problems, [])
  })
}

const ok = (block: Block) => assert.deepEqual(validateBlockFields([block]), [])
const bad = (block: Block, pattern: RegExp) => {
  const issues = validateBlockFields([block])
  assert.ok(issues.some((i) => pattern.test(`${i.path}: ${i.message}`)), JSON.stringify(issues))
}

test('az űrlap üres értékei (\'\', [], üres objektum) a nem kötelező mezőknél rendben vannak', () => {
  ok({ component: 'PageTitle', values: { breadcrumb: [{ label: 'Főoldal', href: '/' }], title: 'Cím', intro: '', cover: { src: '', alt: '' } } })
})

test('kötelező mező hiánya vagy csak szóköz', () => {
  bad({ component: 'PageTitle', values: { breadcrumb: [] } }, /^title/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: '   ' } }, /^title: required/)
  // Kitöltött borítóképnél az alt is kötelező.
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', cover: { src: '/media/a.jpg', alt: '' } } }, /^cover\.alt/)
})

test('ismeretlen komponens, változat és mező', () => {
  bad({ component: 'Marquee', values: {} }, /unknown component/)
  bad({ component: 'CardGrid', variant: 'carousel', values: { items: [] } }, /unknown variant/)
  bad({ component: 'CardGrid', values: { items: [] } }, /unknown variant/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', onclick: 'alert(1)' } }, /onclick|Unrecognized/)
})

test('rossz típus, select-érték és veszélyes link', () => {
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 42 } }, /^title/)
  bad({ component: 'CardGrid', variant: 'text', values: { columns: 7, items: [{ title: 'A' }] } }, /^columns/)
  bad({ component: 'CardGrid', variant: 'text', values: { items: [{ title: 'A', href: 'javascript:alert(1)' }] } }, /^items\.0\.href: unsafe/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', cover: { src: 'javascript:x', alt: 'a' } } }, /cover\.src/)
  ok({ component: 'CardGrid', variant: 'text', values: { columns: 3, items: [{ title: 'A', href: '/nyolcadikos' }] } })
})
