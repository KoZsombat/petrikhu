import type { ReactNode } from 'react'
import { cx } from '../cx'
import type { T } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

/** Shared section container: max 1240 px, 20 px (mobile) / 40 px inner margin. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mx-auto w-full max-w-[1240px] px-5 sm:px-10', className)}>{children}</div>
}

/** Green, uppercase mono date tag (on cards and news rows). */
export function DateTag({ date, className }: { date: string; className?: string }) {
  return (
    <span className={cx('inline-block rounded-sm bg-petrikaccent px-2 py-1 font-mono text-[11px] uppercase leading-none tracking-[0.06em] text-petrikcard', className)}>
      {date}
    </span>
  )
}

/** The first `limit` items; all when there is no limit. */
export function take<T>(items: T[] | undefined, limit?: number): T[] {
  const list = items ?? []
  return limit === undefined ? list : list.slice(0, Math.max(0, limit))
}

/** What every block gets besides its props. */
export type BlockContext = {
  locale: Locale
  t: T
  /** The page's own path and query (news list filters and paging). */
  path: string
  searchParams: Record<string, string | undefined>
}
