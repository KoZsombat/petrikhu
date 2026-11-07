import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Capability } from '@petrik/shared/roles'
import type { SessionUser } from '@petrik/shared/schemas'
import { get, post } from './api.ts'

type Session = {
  user: SessionUser | null
  capabilities: Capability[]
  loading: boolean
  can: (capability: Capability) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Reloads the user from /auth/me (e.g. after the password change that clears `mustChangePassword`). */
  refresh: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: SessionUser | null; capabilities: Capability[]; loading: boolean }>({ user: null, capabilities: [], loading: true })

  const refresh = useCallback(
    () =>
      get<{ user: SessionUser; capabilities: Capability[] }>('/auth/me')
        .then(({ user, capabilities }) => setState({ user, capabilities, loading: false }))
        .catch(() => setState({ user: null, capabilities: [], loading: false })),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const { user, capabilities } = await post<{ user: SessionUser; capabilities: Capability[] }>('/auth/login', { username, password })
    setState({ user, capabilities, loading: false })
  }, [])

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined)
    setState({ user: null, capabilities: [], loading: false })
  }, [])

  const value: Session = { ...state, can: (capability) => state.capabilities.includes(capability), login, logout, refresh }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider missing')
  return session
}
