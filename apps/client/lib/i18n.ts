import { translator } from '@petrik/shared/i18n'
import type { Locale, MessageKey } from '@petrik/shared/i18n'

export type T = (key: MessageKey, values?: Record<string, string | number>) => string
export const t = (locale: Locale): T => translator(locale)
export type { Locale }

/** Where a locale's home page is. */
export const homeOf = (locale: Locale) => (locale === 'en' ? '/en' : '/')
/** The public URL of a page. */
export const pageHref = (locale: Locale, slug: string) => (locale === 'en' ? `/en/${slug}` : `/${slug}`)
