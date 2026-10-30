// Makes the English translation gaps visible: every page and tr("...") label without an English version is
// listed in the test output (diagnostics). Not a failure: the translation is known to be partial.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

test('built-in pages without an English version', (t) => {
  const hu = Object.keys(JSON.parse(read('src/pages/samples/pages.json')))
  const en = new Set(Object.keys(JSON.parse(read('src/pages/samples/pages.en.json'))))
  const missing = hu.filter((slug) => !en.has(slug))
  t.diagnostic(`${missing.length} / ${hu.length} pages untranslated: ${missing.join(', ') || '-'}`)
  // Every English page must have a Hungarian original (no orphans).
  assert.deepEqual([...en].filter((slug) => !hu.includes(slug)), [])
})

test('UI labels passed to tr() without an English translation', (t) => {
  const dictionary = read('src/i18n/en.ts')
  const labels = new Set<string>()
  for (const file of sources('src')) {
    for (const match of read(file).matchAll(/\btr\(\s*"((?:[^"\\]|\\.)+)"\s*\)/g)) labels.add(JSON.parse(`"${match[1]}"`))
  }
  const missing = [...labels].filter((label) => !dictionary.includes(JSON.stringify(label)) && !dictionary.includes(`'${label}'`))
  t.diagnostic(`${missing.length} / ${labels.size} tr() labels untranslated${missing.length ? `: ${missing.join(' | ')}` : ''}`)
  assert.ok(labels.size > 10)
})
