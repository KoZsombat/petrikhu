import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { get } from '../api.ts'
import { useSession } from '../session.tsx'
import { Button, Input, Label, Notice } from '../ui.tsx'

export function Login() {
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    get<{ demoLogins: boolean }>('/auth/config').then((c) => setDemo(c.demoLogins)).catch(() => undefined)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-petriklinesoft bg-petrikcard p-6 shadow-sm">
        <p className="petrik-eyebrow font-mono text-[11px] uppercase tracking-[0.18em] text-petrikaccentdark">Petrik Lajos Két Tanítási Nyelvű Technikum</p>
        <h1 className="mt-2 mb-5 font-display text-2xl font-bold">Bejelentkezés</h1>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="space-y-4">
          <Label label="Felhasználónév">
            <Input name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Label>
          <Label label="Jelszó">
            <Input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Label>
          <Button type="submit" tone="primary" disabled={busy} className="w-full justify-center">
            Belépés
          </Button>
        </div>
        {demo && (
          <p className="mt-5 text-xs text-petrikfaint">
            Bemutató fiókok: <code>mk.vezeto</code> / PetrikMK2026!, <code>helyettes</code> / PetrikHelyettes2026!, <code>igazgato</code> / PetrikIgazgato2026!
          </p>
        )}
      </form>
    </div>
  )
}
