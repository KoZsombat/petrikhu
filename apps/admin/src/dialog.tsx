/**
 * The admin's one modal dialog (confirmations, conflicts): Hungarian, keyboard-accessible (focus stays inside,
 * Esc cancels, focus returns to the element that opened it). Screens call `useDialog().confirm(...)` or
 * `.ask(...)`, which resolve when the user chooses.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { dateTime } from '@petrik/shared/format'
import type { ConflictInfo } from '@petrik/shared/schemas'
import { conflictOf } from './api.ts'
import { Button } from './ui.tsx'

type Tone = 'primary' | 'secondary' | 'danger'
export type Choice<T> = { label: string; value: T; tone?: Tone }
export type AskOptions<T> = {
  title: string
  message?: ReactNode
  choices: Choice<T>[]
  cancelLabel?: string
  /** An extra checkbox (e.g. "delete the file too"); its state comes back with the choice. */
  option?: { label: string; defaultChecked?: boolean }
}
export type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }

type Pending = AskOptions<unknown> & { resolve: (result: { value: unknown; option: boolean } | null) => void; opener: Element | null }

type DialogApi = {
  ask: <T>(options: AskOptions<T>) => Promise<{ value: T; option: boolean } | null>
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogApi | null>(null)

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function DialogView({ pending, onDone }: { pending: Pending; onDone: (result: { value: unknown; option: boolean } | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const messageId = useId()
  const [option, setOption] = useState(!!pending.option?.defaultChecked)

  useEffect(() => {
    // The safe choice first: the cancel button (last in the row) unless nothing is dangerous.
    const dangerous = pending.choices.some((choice) => choice.tone === 'danger')
    const target = box.current?.querySelector<HTMLElement>(dangerous ? '[data-cancel]' : '[data-choice]')
    target?.focus()
  }, [pending])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onDone(null)
      return
    }
    if (event.key !== 'Tab' || !box.current) return
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onDone(null)}>
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={pending.message ? messageId : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-xl bg-petrikcard p-5 shadow-xl"
      >
        <h2 id={titleId} className="font-display text-xl font-bold">
          {pending.title}
        </h2>
        {pending.message && (
          <div id={messageId} className="mt-2 text-sm text-petriksoft">
            {pending.message}
          </div>
        )}
        {pending.option && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={option} onChange={(e) => setOption(e.target.checked)} />
            {pending.option.label}
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {pending.choices.map((choice) => (
            <Button key={choice.label} data-choice tone={choice.tone === 'danger' ? 'dangerSolid' : (choice.tone ?? 'primary')} onClick={() => onDone({ value: choice.value, option })}>
              {choice.label}
            </Button>
          ))}
          <Button data-cancel onClick={() => onDone(null)}>
            {pending.cancelLabel ?? 'Mégse'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback(<T,>(options: AskOptions<T>) => {
    return new Promise<{ value: T; option: boolean } | null>((resolve) => {
      setPending({ ...(options as AskOptions<unknown>), resolve: resolve as Pending['resolve'], opener: document.activeElement })
    })
  }, [])

  const confirm = useCallback(
    async (options: ConfirmOptions) =>
      !!(await ask({ title: options.title, message: options.message, cancelLabel: options.cancelLabel, choices: [{ label: options.confirmLabel ?? 'Igen', value: true, tone: options.destructive ? 'danger' : 'primary' }] })),
    [ask],
  )

  const done = (result: { value: unknown; option: boolean } | null) => {
    if (!pending) return
    const { resolve, opener } = pending
    setPending(null)
    resolve(result)
    // Back to the button that opened the dialog (if it is still on the page).
    if (opener instanceof HTMLElement && opener.isConnected) requestAnimationFrame(() => opener.focus())
  }

  return (
    <DialogContext.Provider value={{ ask, confirm }}>
      {children}
      {pending && <DialogView pending={pending} onDone={done} />}
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogApi {
  const api = useContext(DialogContext)
  if (!api) throw new Error('DialogProvider missing')
  return api
}

/**
 * A save that lost the race (409 conflict): "XY mentette közben (időpont)". Resolves 'reload' (discard mine),
 * 'overwrite' (save mine anyway, with the version in `info`) or null (cancel: keep editing).
 */
export async function resolveConflict(dialog: DialogApi, info: ConflictInfo): Promise<'reload' | 'overwrite' | null> {
  const who = info.savedBy ?? 'Valaki'
  const when = info.savedAt ? dateTime(info.savedAt) : 'az imént'
  const result = await dialog.ask({
    title: 'Közben valaki más is mentett',
    message: (
      <>
        <p>
          <strong>{who}</strong> mentette közben ({when}).
        </p>
        <p className="mt-2">Újratöltéskor az ő változata jelenik meg, és a te módosításaid elvesznek. Felülíráskor a te változatod kerül a helyére, az övé elvész.</p>
      </>
    ),
    choices: [
      { label: 'Újratöltés (az enyém elvetése)', value: 'reload' as const, tone: 'secondary' },
      { label: 'Felülírás (az enyém mentése)', value: 'overwrite' as const, tone: 'danger' },
    ],
  })
  return result?.value ?? null
}

/**
 * Runs a versioned save; on a 409 conflict asks the user (resolveConflict): overwrite saves again with the
 * current version, reload calls `reload`. Resolves the save's result, or null when the user reloaded or cancelled.
 */
export async function saveVersioned<T>(dialog: DialogApi, version: number, save: (version: number) => Promise<T>, reload: () => void): Promise<T | null> {
  try {
    return await save(version)
  } catch (error) {
    const info = conflictOf(error)
    if (!info) throw error
    const choice = await resolveConflict(dialog, info)
    if (choice === 'overwrite') return saveVersioned(dialog, info.version, save, reload)
    if (choice === 'reload') reload()
    return null
  }
}
