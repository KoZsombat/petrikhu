import type { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'
import { Landing } from '@/components/landing/Landing'
import { t } from '@/lib/i18n'
import { schoolData } from '@/lib/structured'

export const metadata: Metadata = { alternates: { canonical: '/en', languages: { hu: '/', en: '/en', 'x-default': '/' } } }

export default function Page() {
  return (
    <>
      <JsonLd data={schoolData('en')} />
      <Landing t={t('en')} locale="en" />
    </>
  )
}
