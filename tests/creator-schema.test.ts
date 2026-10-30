// The shared Creator schema (shared/pnw/creator-schema.ts) and the server-side field validation (server/lib/creator-validation.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateBlockFields } from '../server/lib/creator-validation.ts'

type Block = { component: string; variant?: string; values: Record<string, unknown> }
const pages = (name: string) => JSON.parse(readFileSync(new URL(`../src/pages/samples/${name}`, import.meta.url), 'utf8')) as Record<string, Block[]>

for (const file of ['pages.json', 'pages.en.json']) {
  test(`every page of the built-in ${file} matches the schema`, () => {
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

test('the form\'s empty values (\'\', [], empty object) are fine for non-required fields', () => {
  ok({ component: 'PageTitle', values: { breadcrumb: [{ label: 'Főoldal', href: '/' }], title: 'Cím', intro: '', cover: { src: '', alt: '' } } })
})

test('missing required field or only spaces', () => {
  bad({ component: 'PageTitle', values: { breadcrumb: [] } }, /^title/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: '   ' } }, /^title: required/)
  // With a filled cover image, alt is required too.
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', cover: { src: '/media/a.jpg', alt: '' } } }, /^cover\.alt/)
})

test('unknown component, variant and field', () => {
  bad({ component: 'Marquee', values: {} }, /unknown component/)
  bad({ component: 'CardGrid', variant: 'carousel', values: { items: [] } }, /unknown variant/)
  bad({ component: 'CardGrid', values: { items: [] } }, /unknown variant/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', onclick: 'alert(1)' } }, /onclick|Unrecognized/)
})

test('wrong type, select value and dangerous link', () => {
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 42 } }, /^title/)
  bad({ component: 'CardGrid', variant: 'text', values: { columns: 7, items: [{ title: 'A' }] } }, /^columns/)
  bad({ component: 'CardGrid', variant: 'text', values: { items: [{ title: 'A', href: 'javascript:alert(1)' }] } }, /^items\.0\.href: unsafe/)
  bad({ component: 'PageTitle', values: { breadcrumb: [], title: 'X', cover: { src: 'javascript:x', alt: 'a' } } }, /cover\.src/)
  ok({ component: 'CardGrid', variant: 'text', values: { columns: 3, items: [{ title: 'A', href: '/nyolcadikos' }] } })
})
