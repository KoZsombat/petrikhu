import type { BlockProps } from '@petrik/shared/blocks'
import { dateTag } from '@petrik/shared/format'
import type { PublicPostSummary } from '@petrik/shared/schemas'
import { fold } from '@petrik/shared/slug'
import { getPosts } from '@/lib/api'
import type { Locale, T } from '@/lib/i18n'
import { cx } from '../cx'
import { Picture } from '../Picture'
import { SmartLink } from '../SmartLink'
import { ROW } from './Rows'
import { Container, DateTag, take } from './shared'
import type { BlockContext } from './shared'

export type NewsRow = { title: string; excerpt?: string; date: string; category?: string; image?: { src: string; alt: string }; href: string }

export const PER_PAGE = 10

export function toRow(post: PublicPostSummary, locale: Locale): NewsRow {
  return {
    title: post.title,
    excerpt: post.excerpt,
    date: dateTag(post.publishedAt, locale),
    category: post.categories[0],
    image: post.image ? { src: post.image, alt: post.title } : undefined,
    href: `/hirek/${post.slug}`,
  }
}

/** The latest news (live, optionally filtered and paged) or hand-picked rows. */
export async function NewsList(props: BlockProps<'newsList'>, ctx: BlockContext) {
  const manual = props.items?.length ? props.items : null
  const chosen = props.category || (props.filters?.length ? ctx.searchParams.kategoria : undefined) || undefined
  const page = props.paginate ? Math.max(1, Math.floor(Number(ctx.searchParams.oldal)) || 1) : 1
  const perPage = props.paginate ? PER_PAGE : (props.limit ?? PER_PAGE)

  let rows: NewsRow[]
  let total = 1
  if (manual) rows = take(manual, props.limit)
  else {
    const result = await getPosts({ limit: perPage, offset: (page - 1) * perPage, category: chosen })
    rows = result.posts.map((post) => toRow(post, ctx.locale))
    total = Math.max(1, Math.ceil(result.total / perPage))
  }

  const query = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { kategoria: ctx.searchParams.kategoria, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value)
    const qs = params.toString()
    return qs ? `${ctx.path}?${qs}` : ctx.path
  }
  const filters = props.filters?.map((f) => ({
    label: f.label,
    href: query({ kategoria: f.category, oldal: undefined }),
    active: chosen ? !!f.category && fold(f.category) === fold(chosen) : !f.category,
  }))

  return (
    <section data-component="newsList" className="py-14 md:py-16">
      <Container>
        <NewsRows rows={rows} t={ctx.t} filters={filters} pagination={props.paginate && !manual ? { current: Math.min(page, total), total, hrefFor: (p) => query({ oldal: p === 1 ? undefined : String(p) }) } : undefined} />
      </Container>
    </section>
  )
}

type Pagination = { current: number; total: number; hrefFor: (page: number) => string }

export function NewsRows({ rows, t, filters, pagination }: { rows: NewsRow[]; t: T; filters?: { label: string; href: string; active: boolean }[]; pagination?: Pagination }) {
  return (
    <>
      {filters && filters.length > 0 && (
        <nav aria-label={t('common.filters')} className="mb-8">
          <ul className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
              <li key={i}>
                <SmartLink
                  href={f.href}
                  aria-current={f.active ? 'true' : undefined}
                  className={cx(
                    'inline-block rounded-full border px-4 py-1.5 text-sm font-medium',
                    f.active ? 'border-petrikaccent bg-petrikaccent text-petrikcard' : 'border-petrikline bg-petrikcard text-petrikink hover:border-petrikaccent',
                  )}
                >
                  {f.label}
                </SmartLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ul>
        {rows.map((row, i) => (
          <li key={i} className={ROW}>
            <article className="group relative grid gap-4 py-6 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6 md:grid-cols-[240px_minmax(0,1fr)_auto]">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:w-60">
                {row.image ? (
                  <Picture src={row.image.src} alt={row.image.alt} loading="lazy" sizes="(min-width: 640px) 240px, 100vw" className="size-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="petrik-stripes size-full" />
                )}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-petrikaccent" />
              </div>
              <div className="min-w-0">
                <DateTag date={row.date} />
                <h3 className="mt-2.5 font-display text-[19px] font-semibold leading-snug">
                  <SmartLink href={row.href} className="after:absolute after:inset-0 after:content-[''] group-hover:text-petrikaccent">
                    {row.title}
                  </SmartLink>
                </h3>
                {row.excerpt && <p className="mt-2 text-sm leading-[1.55] text-petriksoft">{row.excerpt}</p>}
              </div>
              {row.category && <p className="petrik-eyebrow md:self-start md:text-right">{row.category}</p>}
            </article>
          </li>
        ))}
      </ul>

      {pagination && pagination.total > 1 && <Pager {...pagination} t={t} />}
    </>
  )
}

function pageWindow(current: number, total: number): (number | 'gap')[] {
  const pages = [...new Set([1, total, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

const PAGE_BTN = 'inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-petriklinesoft bg-petrikcard px-3 text-sm font-medium'

function Pager({ current, total, hrefFor, t }: Pagination & { t: T }) {
  return (
    <nav aria-label={t('common.pagination')} className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {current > 1 ? (
            <SmartLink href={hrefFor(current - 1)} rel="prev" className={cx(PAGE_BTN, 'hover:border-petrikaccent')}>
              ‹ {t('common.previous')}
            </SmartLink>
          ) : (
            <span aria-disabled="true" className={cx(PAGE_BTN, 'text-petrikfaint')}>
              ‹ {t('common.previous')}
            </span>
          )}
        </li>
        {pageWindow(current, total).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-petrikfaint">
              …
            </li>
          ) : (
            <li key={p}>
              <SmartLink
                href={hrefFor(p)}
                aria-current={p === current ? 'page' : undefined}
                aria-label={t('common.page', { n: p })}
                className={cx(PAGE_BTN, p === current ? 'border-petrikink bg-petrikink text-petrikcard' : 'hover:border-petrikaccent')}
              >
                {p}
              </SmartLink>
            </li>
          ),
        )}
        <li>
          {current < total ? (
            <SmartLink href={hrefFor(current + 1)} rel="next" className={cx(PAGE_BTN, 'hover:border-petrikaccent')}>
              {t('common.next')} ›
            </SmartLink>
          ) : (
            <span aria-disabled="true" className={cx(PAGE_BTN, 'text-petrikfaint')}>
              {t('common.next')} ›
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
