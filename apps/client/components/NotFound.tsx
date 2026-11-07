import { SmartLink } from './SmartLink'
import type { Locale, T } from '@/lib/i18n'

export function NotFound({ t, locale }: { t: T; locale: Locale }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="text-3xl font-semibold">{t('common.notFound')}</h1>
      <SmartLink href={locale === 'en' ? '/en' : '/'} className="mt-6 inline-block underline">
        {t('common.backHome')}
      </SmartLink>
    </div>
  )
}
