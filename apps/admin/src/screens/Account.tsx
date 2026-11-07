import { useState } from 'react'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@petrik/shared/roles'
import { put } from '../api.ts'
import { useSession } from '../session.tsx'
import { Button, Card, Input, Label, PageHeader, useAction } from '../ui.tsx'

/** Own account: role and password change (which logs the account out everywhere else). */
export function Account() {
  const { user } = useSession()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [again, setAgain] = useState('')
  const action = useAction()
  if (!user) return null

  return (
    <div className="max-w-xl">
      <PageHeader title="Saját fiók" />
      {action.view}
      <Card className="mb-5">
        <p className="font-medium">{user.displayName}</p>
        <p className="font-mono text-xs text-petrikfaint">{user.username}</p>
        <p className="mt-2 text-sm">
          <strong>{ROLE_LABEL[user.role]}</strong> – {ROLE_DESCRIPTION[user.role]}
        </p>
      </Card>
      <Card title="Jelszó megváltoztatása">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (newPassword !== again) {
              action.setMessage({ tone: 'error', text: 'A két új jelszó nem egyezik.' })
              return
            }
            action.run(async () => {
              await put('/auth/password', { currentPassword, newPassword })
              setCurrent('')
              setNew('')
              setAgain('')
            }, 'Jelszó megváltoztatva. A többi eszközön ki lettél jelentkeztetve.')
          }}
        >
          <Label label="Jelenlegi jelszó">
            <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          </Label>
          <Label label="Új jelszó" hint="Legalább 10 karakter.">
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          </Label>
          <Label label="Új jelszó még egyszer">
            <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </Label>
          <Button type="submit" tone="primary" disabled={action.busy}>
            Jelszó módosítása
          </Button>
        </form>
      </Card>
    </div>
  )
}
