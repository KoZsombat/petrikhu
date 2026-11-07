/** The simpler blocks: text, feature, callout, check list, links, logos, gallery, table, video, accordion, CTA. */
import type { ReactNode } from 'react'
import type { BlockProps } from '@petrik/shared/blocks'
import { youtubeId } from '@petrik/shared/links'
import { YouTube } from '../YouTube'
import { cx } from '../cx'
import { Picture } from '../Picture'
import { RichContent } from '../RichContent'
import { SmartLink } from '../SmartLink'
import { Container, take } from './shared'
import type { BlockContext } from './shared'

const BUTTON = 'inline-block rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard hover:bg-petrikaccentdark'
const H2 = 'mb-6 font-display text-2xl font-bold text-balance'

export function RichTextBlock({ content }: BlockProps<'richText'>, ctx: BlockContext) {
  return (
    <section data-component="richText" className="py-14 md:py-16">
      <Container>
        <RichContent doc={content} embedTitle={ctx.t('common.embedded')} playLabel={(name) => ctx.t('common.playVideo', { title: name })} />
      </Container>
    </section>
  )
}

/** Image + text in two columns, with the image on either side. */
export function Feature({ eyebrow, title, content, image, imageSide, ctaLabel, ctaHref }: BlockProps<'feature'>, ctx: BlockContext) {
  return (
    <section data-component="feature" data-variant={imageSide} className="py-12 md:py-16">
      <Container className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        {image && (
          <div className={cx('relative overflow-hidden rounded-xl', imageSide === 'right' && 'md:order-2')}>
            <Picture src={image.src} alt={image.alt} loading="lazy" sizes="(min-width: 768px) 580px, 100vw" className="aspect-[4/3] w-full object-cover" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-petrikaccent" />
          </div>
        )}
        <div className={cx(!image && 'md:col-span-2')}>
          {eyebrow && <p className="petrik-eyebrow mb-3">{eyebrow}</p>}
          <h2 className="font-display text-3xl font-bold leading-tight text-balance">{title}</h2>
          {content && <RichContent doc={content} className="mt-4" embedTitle={ctx.t('common.embedded')} playLabel={(name) => ctx.t('common.playVideo', { title: name })} />}
          {ctaLabel && ctaHref && (
            <SmartLink href={ctaHref} className={cx('mt-6', BUTTON)}>
              {ctaLabel}
            </SmartLink>
          )}
        </div>
      </Container>
    </section>
  )
}

/** Highlighted notice: `info` subtle, `accent` solid green, `highlight` the slim tinted bar with an eyebrow title. */
export function Callout({ title, content, tone }: BlockProps<'callout'>, ctx: BlockContext) {
  if (tone === 'highlight') {
    return (
      <section data-component="callout" data-variant="highlight" className="py-14 md:py-16">
        <Container>
          <div className="rounded-r-lg border-l-4 border-petrikaccent bg-petriktint px-6 py-5">
            {title && <p className="petrik-eyebrow mb-2">{title}</p>}
            <RichContent doc={content} variant="bare" className="max-w-[72ch] text-[15.5px] leading-relaxed text-petrikink [&_p+p]:mt-3" />
          </div>
        </Container>
      </section>
    )
  }
  const accent = tone === 'accent'
  return (
    <section data-component="callout" data-variant={tone} className="py-8 md:py-10">
      <Container>
        <div className={cx('rounded-xl border-l-4 p-6 md:p-8', accent ? 'border-petrikaccentdark bg-petrikaccent text-petrikcard' : 'border-petrikaccent bg-petriktint')}>
          {title && <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>}
          <RichContent doc={content} className={cx(accent && '[&_a]:text-petrikcard [&_*]:text-petrikcard')} embedTitle={ctx.t('common.embedded')} playLabel={(name) => ctx.t('common.playVideo', { title: name })} />
        </div>
      </Container>
    </section>
  )
}

export function CheckList({ title, items, sideTitle, sideText, limit }: BlockProps<'checkList'>) {
  const hasSide = Boolean(sideTitle || sideText)
  return (
    <section data-component="checkList" data-variant={hasSide ? 'side' : 'columns'} className="py-14 md:py-16">
      <Container>
        {title && <h2 className={H2}>{title}</h2>}
        <div className={cx(hasSide && 'grid gap-8 sm:grid-cols-2 sm:gap-12')}>
          <ul className={cx(!hasSide && 'gap-x-12 sm:columns-2')}>
            {take(items, limit).map((item, i) => (
              <li key={i} className="mb-3.5 flex break-inside-avoid items-start gap-3 text-[15px] leading-snug">
                <span aria-hidden="true" className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full bg-petriktint text-xs font-bold text-petrikaccentdark">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {hasSide && (
            <div>
              {sideTitle && <h3 className="petrik-eyebrow mb-2">{sideTitle}</h3>}
              {sideText && <p className="text-[15px] leading-relaxed text-petriksoft">{sideText}</p>}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}

/** Links / downloadable documents in two columns, with arrows. */
export function LinkList({ heading, items, limit }: BlockProps<'linkList'>) {
  const text = (title: string, meta?: string): ReactNode => (
    <span>
      <span className="block font-semibold leading-snug">{title}</span>
      {meta && <span className="mt-0.5 block text-sm text-petriksoft">{meta}</span>}
    </span>
  )
  return (
    <section data-component="linkList" className="py-12 md:py-16">
      <Container>
        {heading && <h2 className={H2}>{heading}</h2>}
        <ul className="grid gap-3 md:grid-cols-2">
          {take(items, limit).map((item, i) => (
            <li key={i}>
              {item.href ? (
                <SmartLink
                  href={item.href}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-petrikline bg-petrikcard px-5 py-4 transition-colors hover:border-petrikaccent hover:bg-petriktint"
                >
                  {text(item.title, item.meta)}
                  <span aria-hidden="true" className="text-petrikaccentdark transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </SmartLink>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-petriklinesoft bg-petrikcard px-5 py-4">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-petrikaccent" />
                  {text(item.title, item.meta)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

const TILE = 'flex h-[78px] items-center justify-center rounded-lg border border-petriklinesoft bg-petrikcard p-2'

export function LogoGrid({ label, logos, limit }: BlockProps<'logoGrid'>) {
  return (
    <section data-component="logoGrid" className="py-14 md:py-16">
      <Container>
        {label && <h2 className="petrik-eyebrow mb-4">{label}</h2>}
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          {take(logos, limit).map((logo, i) => {
            const content = logo.src ? (
              <Picture src={logo.src} alt={logo.alt} sizes="160px" loading="lazy" className="max-h-[70%] max-w-[70%] object-contain" />
            ) : (
              <span className="px-2 text-center font-mono text-xs text-petrikfaint">{logo.alt}</span>
            )
            return (
              <li key={i}>
                {logo.href ? (
                  <SmartLink href={logo.href} aria-label={logo.alt} className={cx(TILE, 'hover:border-petrikline')}>
                    {content}
                  </SmartLink>
                ) : (
                  <div className={TILE}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}

const GALLERY_COLS = { 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' } as const

/** Square-ish cropped tiles; a tile opens the original image. */
export function Gallery({ heading, columns, images, limit }: BlockProps<'gallery'>) {
  return (
    <section data-component="gallery" className="py-12 md:py-16">
      <Container>
        {heading && <h2 className={H2}>{heading}</h2>}
        <ul className={cx('grid grid-cols-1 gap-3', GALLERY_COLS[columns])}>
          {take(images, limit).map((image, i) => (
            <li key={i} className="overflow-hidden rounded-lg">
              <a href={image.src} target="_blank" rel="noopener noreferrer">
                <Picture src={image.src} alt={image.alt ?? ''} loading="lazy" sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-105" />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** In a cell, `[label](https://address)` becomes a link; everything else is plain text. */
function cell(text: string): ReactNode {
  const parts: ReactNode[] = []
  const link = /\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:)[^)\s]+)\)/g
  let last = 0
  for (const m of text.matchAll(link)) {
    parts.push(text.slice(last, m.index))
    parts.push(
      <SmartLink key={m.index} href={m[2]} className="text-petrikaccentdark underline underline-offset-2 hover:text-petrikaccent">
        {m[1]}
      </SmartLink>,
    )
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(text.slice(last))
  return parts
}

/** A grid on large screens, cards per row on mobile (the column header above each cell). */
export function Table({ heading, columns, rows, footnote, limit }: BlockProps<'table'>) {
  return (
    <section data-component="table" className="py-12 md:py-16">
      <Container>
        {heading && <h2 className={H2}>{heading}</h2>}
        <div className="overflow-hidden rounded-xl border border-petrikline bg-petrikcard">
          <table className="block w-full border-collapse text-[15px] md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-petriktint text-left">
                {columns.map((column, i) => (
                  <th key={i} className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-petrikaccentdark">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {take(rows, limit).map((row, r) => (
                <tr key={r} className="block border-t border-petriklinesoft first:border-t-0 md:table-row md:odd:bg-transparent md:even:bg-petrikcream/60">
                  {columns.map((column, c) => (
                    <td
                      key={c}
                      data-label={column}
                      className={cx(
                        'block whitespace-pre-line px-5 py-2 align-top leading-snug before:mb-0.5 before:block before:font-mono before:text-[10px] before:uppercase before:tracking-[0.15em] before:text-petrikfaint before:content-[attr(data-label)] md:table-cell md:py-4 md:before:hidden',
                        c === 0 && 'font-semibold text-petrikaccentdark',
                      )}
                    >
                      {cell(row.cells[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footnote && <p className="mt-3 text-sm text-petriksoft">{footnote}</p>}
      </Container>
    </section>
  )
}

/** A 16:9 YouTube video, loaded only on click (youtube-nocookie); a plain link for anything else. */
export function Video({ heading, url, title, caption }: BlockProps<'video'>, ctx: BlockContext) {
  const id = youtubeId(url)
  return (
    <section data-component="video" className="py-12 md:py-16">
      <Container>
        {heading && <h2 className="mx-auto mb-6 max-w-4xl font-display text-2xl font-bold text-balance">{heading}</h2>}
        {id ? (
          <div className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-xl bg-petrikink">
            <YouTube id={id} title={title ?? ctx.t('common.video')} playLabel={ctx.t('common.playVideo', { title: title ?? ctx.t('common.video') })} />
          </div>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-petrikaccentdark underline">
            ▶ {title ?? url}
          </a>
        )}
        {caption && <p className="mx-auto mt-3 max-w-4xl text-sm text-petriksoft">{caption}</p>}
      </Container>
    </section>
  )
}

/** Native <details>: works without JavaScript. */
export function Accordion({ heading, items, openFirst }: BlockProps<'accordion'>, ctx: BlockContext) {
  return (
    <section data-component="accordion" className="py-12 md:py-16">
      <Container>
        {heading && <h2 className={H2}>{heading}</h2>}
        <div className="divide-y divide-petriklinesoft overflow-hidden rounded-xl border border-petrikline bg-petrikcard">
          {items.map((item, i) => (
            <details key={i} open={openFirst && i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-lg font-semibold hover:bg-petriktint [&::-webkit-details-marker]:hidden">
                {item.title}
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petriktint text-petrikaccentdark transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <RichContent doc={item.content} className="px-5 pb-5" embedTitle={ctx.t('common.embedded')} playLabel={(name) => ctx.t('common.playVideo', { title: name })} />
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}

/** At most one per page, at the bottom. */
export function Cta({ title, buttonLabel, href }: BlockProps<'cta'>) {
  return (
    <section data-component="cta" className="bg-petriktint py-12 md:py-14">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <h2 className="font-display text-2xl font-bold leading-snug text-balance">{title}</h2>
        <SmartLink href={href} className={cx('shrink-0', BUTTON)}>
          {buttonLabel}
        </SmartLink>
      </Container>
    </section>
  )
}
