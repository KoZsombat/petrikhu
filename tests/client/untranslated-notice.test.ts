// English mode: a built-in page without an English version says so instead of silently showing Hungarian.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { closeVite, loadClientModule } from '../helpers/render.ts'

after(closeVite)

type Provider = { Provider: ComponentType<{ value: unknown; children?: ReactNode }> }

async function renderApp(path: string, lang: 'hu' | 'en'): Promise<string> {
  const { default: App } = await loadClientModule<{ default: ComponentType }>('/src/App.tsx')
  const { LanguageContext } = await loadClientModule<{ LanguageContext: Provider }>('/src/i18n/languageContext.ts')
  return renderToString(
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(LanguageContext.Provider, { value: { lang, setLang: () => {}, tr: (hu: string) => hu } }, createElement(App))),
  )
}

const NOTICE = /not yet available in English/

test('untranslated page in English mode shows the notice', async () => {
  assert.match(await renderApp('/hir-cikk', 'en'), NOTICE)
})

test('translated page in English mode and any page in Hungarian mode do not', async () => {
  assert.doesNotMatch(await renderApp('/elerhetoseg', 'en'), NOTICE)
  assert.doesNotMatch(await renderApp('/hir-cikk', 'hu'), NOTICE)
})
