'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Locale } from '@petrik/shared/i18n'

type Props = { locale: Locale; translations: { hu: string; en: string }[]; className?: string; tone?: 'dark' | 'light' }

/** The other language's version of the current page, or that language's home page. */
function counterpart(pathname: string, target: Locale, translations: Props['translations']): string {
  if (target === 'en') {
    const pair = translations.find((t) => pathname === `/${t.hu}`)
    return pair ? `/en/${pair.en}` : '/en'
  }
  const pair = translations.find((t) => pathname === `/en/${t.en}`)
  return pair ? `/${pair.hu}` : '/'
}

/** HU | EN; the current language is highlighted. */
export function LanguageSwitch({ locale, translations, className = '', tone = 'dark' }: Props) {
  const pathname = usePathname()
  const item = (code: Locale, label: string) => {
    const active = locale === code
    const cls = `px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider transition-colors ${
      tone === 'light' ? (active ? 'font-semibold text-petrikaccentdark' : 'text-black/50 hover:text-black') : active ? 'text-white' : 'text-petriklink/60 hover:text-white'
    }`
    return active ? (
      <span lang={code} aria-current="true" className={cls}>
        {label}
      </span>
    ) : (
      <Link lang={code} hrefLang={code} href={counterpart(pathname, code, translations)} aria-label={code === 'hu' ? 'Magyar' : 'English'} className={cls}>
        {label}
      </Link>
    )
  }
  return (
    <span className={`inline-flex items-center divide-x ${tone === 'light' ? 'divide-black/20' : 'divide-petriklink/30'} ${className}`}>
      {item('hu', 'HU')}
      {item('en', 'EN')}
    </span>
  )
}
