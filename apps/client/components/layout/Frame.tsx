import type { ReactNode } from 'react'
import { getSite } from '@/lib/api'
import { t as translatorFor } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { socialLinks, upperLinks } from '@/lib/site'
import { Footer } from './Footer'
import { Header } from './Header'
import { UpperHeader } from './UpperHeader'

/** The page frame of the public site: top bar, main menu, footer. */
export async function Frame({ locale, children }: { locale: Locale; children: ReactNode }) {
  const site = await getSite(locale)
  const t = translatorFor(locale)
  return (
    <div className="flex flex-col min-h-screen">
      <header className="contents">
        <UpperHeader t={t} locale={locale} translations={site.translations} />
        <Header
          menu={site.menu}
          locale={locale}
          translations={site.translations}
          upperLinks={upperLinks.map((link) => ({ label: t(link.key), href: link.href }))}
          social={socialLinks}
          labels={{ open: t('nav.openMenu'), close: t('nav.closeMenu'), logo: t('site.logoAlt') }}
        />
      </header>
      <main className="flex-1">{children}</main>
      <Footer t={t} />
    </div>
  )
}
