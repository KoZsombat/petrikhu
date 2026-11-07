/** Small building blocks of the admin screens, in the site's own colours. */
import { useCallback, useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { STATUS_LABEL } from '@petrik/shared/workflow'
import type { PostStatus } from '@petrik/shared/workflow'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

type Tone = 'primary' | 'secondary' | 'danger' | 'dangerSolid' | 'ghost'
const TONES: Record<Tone, string> = {
  /** The confirm button of a destructive action (permanent delete, deleting a file, overwriting). */
  dangerSolid: 'bg-red-700 text-white border-transparent hover:bg-red-800',
  primary: 'bg-petrikaccent text-white hover:bg-petrikaccentdark border-transparent',
  secondary: 'bg-petrikcard text-petrikink border-petrikline hover:border-petrikaccent',
  danger: 'bg-petrikcard text-red-700 border-red-200 hover:bg-red-50',
  ghost: 'bg-transparent text-petriksoft border-transparent hover:bg-petriktint',
}

export function Button({ tone = 'secondary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; 'data-choice'?: boolean; 'data-cancel'?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrikaccent disabled:cursor-not-allowed disabled:opacity-50', TONES[tone], className)}
    />
  )
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-petriklinesoft bg-petrikcard p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

const INPUT = 'block w-full rounded-md border border-petrikline bg-white px-3 py-2 text-sm focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25'

/** A field with its label; the hint sits outside the <label>, so it is not part of the field's name. */
export function Label({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-petrikink">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-petrikfaint">{hint}</p>}
    </div>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cx(INPUT, props.className)} />
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} className={cx(INPUT, props.className)} />
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={cx(INPUT, props.className)} />

export function Notice({ tone = 'info', children, onClose }: { tone?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode; onClose?: () => void }) {
  const colors = { info: 'border-petrikpale bg-petriktint', success: 'border-petrikaccent bg-petriktint', error: 'border-red-300 bg-red-50 text-red-900', warning: 'border-amber-300 bg-amber-50 text-amber-900' }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('mb-4 flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm', colors[tone])}>
      <div>{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Bezárás" className="text-lg leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-petrikcream text-petriksoft border-petrikline',
  in_review: 'bg-amber-50 text-amber-800 border-amber-200',
  scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
  published: 'bg-petriktint text-petrikaccentdark border-petrikpale',
  archived: 'bg-petrikcream text-petrikfaint border-petrikline',
  trash: 'bg-red-50 text-red-800 border-red-200',
}

export function StatusBadge({ status, rejected }: { status: string; rejected?: boolean }) {
  const label = rejected && status === 'draft' ? 'Javításra visszaküldve' : (STATUS_LABEL[status as PostStatus] ?? (status === 'published' ? 'Kiadva' : status))
  return <span className={cx('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_COLORS[rejected ? 'in_review' : status] ?? STATUS_COLORS.draft)}>{label}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-petrikfaint">{children}</p>
}

/** Loads data with a reload function; errors become a message. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: string | null; reload: () => void; loading: boolean } {
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({ data: undefined, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error: Error) => !cancelled && setState((s) => ({ data: s.data, error: error.message, loading: false })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { ...state, reload }
}

/** Runs an action with a busy flag and a message for the result. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const run = useCallback(async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      if (success) setMessage({ tone: 'success', text: success })
      return true
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message })
      return false
    } finally {
      setBusy(false)
    }
  }, [])
  const view = message && (
    <Notice tone={message.tone} onClose={() => setMessage(null)}>
      {message.text}
    </Notice>
  )
  return { busy, run, view, setMessage }
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-petrikline text-xs uppercase tracking-wider text-petrikfaint">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-petriklinesoft">{children}</tbody>
      </table>
    </div>
  )
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
      <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ Előző
      </Button>
      <span className="text-petriksoft">
        {page} / {totalPages}
      </span>
      <Button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Következő ›
      </Button>
    </div>
  )
}
