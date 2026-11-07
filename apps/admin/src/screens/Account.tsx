import { useState } from 'react'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@petrik/shared/roles'
import { PASSWORD_MIN } from '@petrik/shared/schemas'
import { put } from '../api.ts'
import { useSession } from '../session.tsx'
import { Button, Card, Input, Label, Notice, PageHeader, useAction } from '../ui.tsx'

/** The password change form (own account); it logs the account out everywhere else. */
export function PasswordForm({ onDone, success }: { onDone?: () => void; success: string }) {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [again, setAgain] = useState('')
  const action = useAction()
  return (
    <>
      {action.view}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (newPassword !== again) {
            action.setMessage({ tone: 'error', text: 'A két új jelszó nem egyezik.' })
            return
          }
          action
            .run(async () => {
              await put('/auth/password', { currentPassword, newPassword })
              setCurrent('')
              setNew('')
              setAgain('')
            }, success)
            .then((ok) => ok && onDone?.())
        }}
      >
        <Label label="Jelenlegi jelszó">
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
        </Label>
        <Label label="Új jelszó" hint={`Legalább ${PASSWORD_MIN} karakter.`}>
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        </Label>
        <Label label="Új jelszó még egyszer">
          <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Label>
        <Button type="submit" tone="primary" disabled={action.busy}>
          Jelszó módosítása
        </Button>
      </form>
    </>
  )
}

/** Own account: role and password change. */
export function Account() {
  const { user } = useSession()
  if (!user) return null
  return (
    <div className="max-w-xl">
      <PageHeader title="Saját fiók" />
      <Card className="mb-5">
        <p className="font-medium">{user.displayName}</p>
        <p className="font-mono text-xs text-petrikfaint">{user.username}</p>
        <p className="mt-2 text-sm">
          <strong>{ROLE_LABEL[user.role]}</strong> – {ROLE_DESCRIPTION[user.role]}
        </p>
      </Card>
      <Card title="Jelszó megváltoztatása">
        <PasswordForm success="Jelszó megváltoztatva. A többi eszközön ki lettél jelentkeztetve." />
      </Card>
    </div>
  )
}

/** The only screen of an account that must change its password (set by an admin, or the initial one). */
export function ForcedPasswordChange() {
  const { user, refresh, logout } = useSession()
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-petriklinesoft bg-petrikcard p-6 shadow-sm">
        <p className="petrik-eyebrow font-mono text-[11px] uppercase tracking-[0.18em] text-petrikaccentdark">{user?.displayName}</p>
        <h1 className="mt-2 mb-3 font-display text-2xl font-bold">Új jelszó szükséges</h1>
        <Notice tone="warning">A jelszavadat egy adminisztrátor állította be, vagy ez a kezdő jelszó. Mielőtt továbblépsz, adj meg egy újat, amit csak te ismersz.</Notice>
        <PasswordForm success="Jelszó megváltoztatva." onDone={refresh} />
        <button type="button" onClick={logout} className="mt-4 text-sm text-petriksoft underline hover:text-petrikink">
          Kijelentkezés
        </button>
      </div>
    </div>
  )
}
