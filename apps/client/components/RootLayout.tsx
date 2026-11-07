import type { ReactNode } from 'react'
import { fontVariables } from '@/app/fonts'
import type { Locale } from '@/lib/i18n'
import { Frame } from './layout/Frame'

/** <html> and <body> of one language's site (each language is its own root layout). */
export function RootLayout({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <Frame locale={locale}>{children}</Frame>
      </body>
    </html>
  )
}
