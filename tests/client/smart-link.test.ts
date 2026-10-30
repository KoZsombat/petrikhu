// Header/Footer links: in-app paths navigate client-side (router Link), the rest stay plain anchors.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { closeVite, loadClientModule } from '../helpers/render.ts'

after(closeVite)

type SmartLinkModule = { SmartLink: (props: { href?: string; children?: unknown }) => ReactElement<Record<string, unknown>> }

test('internal path → router Link; external, mail, tel, empty → <a>', async () => {
  const { SmartLink } = await loadClientModule<SmartLinkModule>('/src/components/SmartLink.tsx')
  const internal = SmartLink({ href: '/hirek', children: 'Hírek' })
  // Loaded through Vite, so the Link is not the same object as the one imported here: check its shape instead.
  assert.notEqual(internal.type, 'a')
  assert.equal(typeof Link, typeof internal.type)
  assert.equal(internal.props.to, '/hirek')
  assert.equal(internal.props.href, undefined)

  const external = SmartLink({ href: 'https://kreta.hu' })
  assert.equal(external.type, 'a')
  assert.equal(external.props.target, '_blank')
  assert.equal(external.props.rel, 'noopener noreferrer')
  for (const href of ['mailto:info@petrik.hu', 'tel:+36', '', '//cdn.example.com/x']) {
    const anchor = SmartLink({ href })
    assert.equal(anchor.type, 'a', href)
    assert.equal(anchor.props.target, undefined, href)
  }
})

test('Header and Footer no longer use plain <a href> for internal links', async () => {
  const { readFileSync } = await import('node:fs')
  for (const file of ['src/components/Header.tsx', 'src/components/Footer.tsx']) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /<a\s[^>]*href=/, file)
  }
})
