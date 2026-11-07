import type { Metadata } from 'next'
import { Landing } from '@/components/landing/Landing'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { alternates: { canonical: '/en', languages: { hu: '/' } } }

export default function Page() {
  return <Landing t={t('en')} locale="en" />
}
