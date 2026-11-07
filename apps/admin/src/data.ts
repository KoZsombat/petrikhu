import { useEffect, useState } from 'react'
import type { Term } from '@petrik/shared/schemas'
import { get } from './api.ts'

let usersCache: Promise<Map<string, string>> | null = null
let termsCache: Promise<Term[]> | null = null

/** Account id → display name (for authors and log entries); "—" for a deleted account. */
export function useUserNames(): (id: string | null | undefined) => string {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    usersCache ??= get<{ users: { id: string; displayName: string }[] }>('/users').then(({ users }) => new Map(users.map((u) => [u.id, u.displayName])))
    usersCache.then(setNames).catch(() => (usersCache = null))
  }, [])
  return (id) => (id ? (names.get(id) ?? '—') : '—')
}

export function useTerms(): { terms: Term[]; refresh: () => void } {
  const [terms, setTerms] = useState<Term[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (tick > 0) termsCache = null
    termsCache ??= get<{ terms: Term[] }>('/terms').then((r) => r.terms)
    termsCache.then(setTerms).catch(() => (termsCache = null))
  }, [tick])
  return { terms, refresh: () => setTick((n) => n + 1) }
}

export function invalidateUsers() {
  usersCache = null
}
