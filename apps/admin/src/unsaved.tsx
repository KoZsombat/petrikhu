/**
 * The unsaved-changes guard of the editors: closing or reloading the tab asks the browser's own question
 * (beforeunload); leaving inside the admin (a link, back) asks in the admin's dialog. `allowNext()` lets the
 * editor's own navigation after a save through.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { useDialog } from './dialog.tsx'

export function useUnsavedGuard(dirty: boolean): { allowNext: () => void } {
  const dialog = useDialog()
  const skip = useRef(false)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older browsers need a return value to show the prompt.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skip.current) {
      skip.current = false
      return false
    }
    return dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let active = true
    dialog
      .confirm({
        title: 'Nem mentett módosítások',
        message: 'Ha most továbblépsz, a mentetlen módosításaid elvesznek.',
        confirmLabel: 'Elvetés és továbblépés',
        cancelLabel: 'Maradok',
        destructive: true,
      })
      .then((leave) => {
        if (!active) return
        if (leave) blocker.proceed()
        else blocker.reset()
      })
    return () => {
      active = false
    }
  }, [blocker, dialog])

  const allowNext = useCallback(() => {
    skip.current = true
  }, [])
  return { allowNext }
}
