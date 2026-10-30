// 1.3: a /dokumentumtar is figyelembe veszi az azonos slugú, szerkesztőben kiadott oldalt.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { closeVite, loadClientModule } from '../helpers/render.ts'

after(closeVite)

type ProviderModule<K extends string> = Record<K, { Provider: ComponentType<{ value: unknown; children?: ReactNode }> }>

async function render(pages: Map<string, unknown>, lang: 'hu' | 'en' = 'hu'): Promise<string> {
  const { default: Dokumentumtar } = await loadClientModule<{ default: ComponentType }>('/src/pages/Dokumentumtar.tsx')
  const { SiteContext } = await loadClientModule<ProviderModule<'SiteContext'>>('/src/lib/siteContext.ts')
  const { LanguageContext } = await loadClientModule<ProviderModule<'LanguageContext'>>('/src/i18n/languageContext.ts')
  const tree = createElement(
    MemoryRouter,
    { initialEntries: ['/dokumentumtar'] },
    createElement(
      LanguageContext.Provider,
      { value: { lang, setLang: () => {}, tr: (hu: string) => hu } },
      createElement(SiteContext.Provider, { value: { pages, menu: null, library: null, loading: false } }, createElement(Dokumentumtar)),
    ),
  )
  return renderToString(tree)
}

const editedPage = {
  slug: 'dokumentumtar',
  title: 'Szerkesztett tár',
  description: '',
  blocks: [{ component: 'PageTitle', values: { breadcrumb: [], title: 'Ez a szerkesztett dokumentumtár' } }],
}

test('kiadott oldal nélkül a beépített tár látszik', async () => {
  const html = await render(new Map())
  assert.match(html, /Keresés a dokumentumok között/)
})

test('azonos slugú kiadott oldal felülírja a tárat', async () => {
  const html = await render(new Map([['dokumentumtar', editedPage]]))
  assert.match(html, /Ez a szerkesztett dokumentumtár/)
  assert.doesNotMatch(html, /Keresés a dokumentumok között/)
})

test('angolul a szerkesztett (magyar) oldal nem jelenik meg', async () => {
  const html = await render(new Map([['dokumentumtar', editedPage]]), 'en')
  assert.doesNotMatch(html, /Ez a szerkesztett dokumentumtár/)
})
