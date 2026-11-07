import { Mail, MapPin, Phone } from 'lucide-react'
import { SmartLink } from '../SmartLink'
import type { T } from '@/lib/i18n'
import { footerColumns, socialLinks } from '@/lib/site'
import { FacebookSolid, InstagramSolid } from './icons'
import { Logo } from './Logo'

const LINK = 'text-petriklink hover:text-white transition-colors duration-200'
const ROUND = 'flex size-11 items-center justify-center rounded-full border border-petriklink/20 hover:border-white hover:text-white transition-colors duration-200'

export function Footer({ t }: { t: T }) {
  return (
    <footer className="text-sm bg-petrikink text-petriklink text-center md:text-start">
      <div className="md:max-w-4/6 mx-auto px-4 pt-14 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr]">
          <div>
            <div className="inline-block rounded-lg bg-white p-1">
              <Logo alt={t('site.logoAlt')} className="h-auto w-52" />
            </div>
            <p className="mt-5 leading-relaxed text-petriklink/80">
              {t('footer.schoolLine1')}
              <br />
              {t('footer.schoolLine2')}
            </p>
            <p className="mt-5 font-mono text-sm leading-6 text-petriklink/50">
              {t('footer.omId')}
              <br />
              {t('footer.techCode')}
            </p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 font-mono text-sm uppercase tracking-[0.25em] text-petriklink/50">{t(col.title)}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.key}>
                    <SmartLink href={link.href} className={LINK}>
                      {t(link.key)}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-4 font-mono text-sm uppercase tracking-[0.25em] text-petriklink/50">{t('nav.contact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start justify-center gap-3 md:justify-start">
                <MapPin size={14} className="mt-1 shrink-0" />
                <span>{t('footer.address')}</span>
              </li>
              <li className="flex items-center justify-center gap-3 md:justify-start">
                <Phone size={14} className="shrink-0" />
                <SmartLink href="tel:+36705021724" className={LINK}>
                  +36 70 502 1724
                </SmartLink>
              </li>
              <li className="flex items-center justify-center gap-3 md:justify-start">
                <Mail size={14} className="shrink-0" />
                <SmartLink href="mailto:info@petrik.hu" className={LINK}>
                  {t('footer.email')}
                </SmartLink>
              </li>
              <li>
                <SmartLink href="/tanari-kar" className={LINK}>
                  {t('nav.staff')}
                </SmartLink>
              </li>
            </ul>
            <div className="mt-4 flex justify-center gap-3 md:justify-start">
              <SmartLink href={socialLinks.facebook} aria-label="Facebook" className={ROUND}>
                <FacebookSolid size={14} />
              </SmartLink>
              <SmartLink href={socialLinks.instagram} aria-label="Instagram" className={ROUND}>
                <InstagramSolid size={14} />
              </SmartLink>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-petriklink/15 pt-6 text-sm sm:flex-row items-center sm:justify-between">
          <p className="text-petriklink/50">{t('footer.copyright')}</p>
          <div className="flex gap-6">
            <SmartLink href="/adatvedelem" className={LINK}>
              {t('nav.privacy')}
            </SmartLink>
            <SmartLink href="/adatkezelesi-tajekoztato" className={LINK}>
              {t('nav.privacyNotice')}
            </SmartLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
