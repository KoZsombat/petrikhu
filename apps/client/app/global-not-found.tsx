import './globals.css'
import type { Metadata } from 'next'
import { NotFound } from '@/components/NotFound'
import { RootLayout } from '@/components/RootLayout'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Az oldal nem található | petrik.hu', robots: { index: false } }

/** A URL that matches no route at all (e.g. /a/b): the Hungarian frame with the 404 text. */
export default function GlobalNotFound() {
  return (
    <RootLayout locale="hu">
      <NotFound t={t('hu')} locale="hu" />
    </RootLayout>
  )
}
