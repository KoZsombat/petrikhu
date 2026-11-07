import type { BlockProps } from '@petrik/shared/blocks'
import { Picture } from '../Picture'
import { SmartLink } from '../SmartLink'
import { Container } from './shared'
import type { BlockContext } from './shared'

export function PageTitle({ breadcrumb, title, intro, cover }: BlockProps<'pageTitle'>, { t }: BlockContext) {
  return (
    <header data-component="pageTitle" data-variant={cover ? 'cover' : 'default'} className="border-b border-petriklinesoft pt-10 pb-8 md:pt-16 md:pb-12">
      <Container>
        <nav aria-label={t('common.breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
            {breadcrumb.map((item, i) => {
              const last = i === breadcrumb.length - 1
              return (
                <li key={`${i}-${item.label}`} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-petrikfaint">
                      /
                    </span>
                  )}
                  {item.href && !last ? (
                    <SmartLink href={item.href} className="text-petrikaccentdark hover:underline">
                      {item.label}
                    </SmartLink>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className="text-petrikfaint">
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        <h1 className="mt-5 font-display text-[32px] font-bold leading-[1.15] text-balance sm:text-[40px] md:text-[42px]">{title}</h1>
        {intro && <p className="mt-4 max-w-[66ch] text-[16.5px] leading-relaxed text-petriksoft md:text-[17px]">{intro}</p>}
        {cover && <Picture src={cover.src} alt={cover.alt} sizes="(min-width: 1240px) 1160px, 100vw" className="mt-8 aspect-[16/6] w-full rounded-lg object-cover" />}
      </Container>
    </header>
  )
}
