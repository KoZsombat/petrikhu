import { Mail, Phone } from 'lucide-react'
import { SmartLink } from '../SmartLink'
import type { Locale, T } from '@/lib/i18n'
import { socialLinks, upperLinks } from '@/lib/site'
import { FacebookOutline, InstagramOutline } from './icons'
import { LanguageSwitch } from './LanguageSwitch'

export function UpperHeader({ t, locale, translations }: { t: T; locale: Locale; translations: { hu: string; en: string }[] }) {
  return (
    <div className="p-2 bg-petrikink w-full">
      <nav className="flex flex-col md:flex-row md:items-center md:max-w-9/10 mx-auto justify-between">
        <div className="flex gap-4 justify-center md:justify-start items-center">
          <a href="tel:+36705021724" className="flex items-center gap-2 text-petriklink hover:text-white cursor-pointer">
            <Phone size={16} />
            <span className="text-md">+36 70 502 1724</span>
          </a>
          <a href="mailto:info@petrik.hu" className="flex items-center gap-2 text-petriklink hover:text-white pr-4 md:border-r border-petriklink/40 cursor-pointer">
            <Mail size={16} />
            <span className="text-md">info@petrik.hu</span>
          </a>
          <SmartLink href={socialLinks.facebook} aria-label="Facebook" className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer">
            <FacebookOutline size={16} />
          </SmartLink>
          <SmartLink href={socialLinks.instagram} aria-label="Instagram" className="hidden md:flex items-center gap-2 text-petriklink hover:text-white cursor-pointer">
            <InstagramOutline size={16} />
          </SmartLink>
        </div>
        <div className="hidden md:flex flex-wrap items-center gap-4">
          {upperLinks.map((link) => (
            <SmartLink key={link.key} href={link.href} className="text-md text-petriklink hover:text-white cursor-pointer">
              {t(link.key)}
            </SmartLink>
          ))}
          <LanguageSwitch locale={locale} translations={translations} />
        </div>
      </nav>
    </div>
  )
}
