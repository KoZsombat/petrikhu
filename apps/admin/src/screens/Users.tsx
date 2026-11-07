import { useState } from 'react'
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from '@petrik/shared/roles'
import type { Role } from '@petrik/shared/roles'
import type { Account } from '@petrik/shared/schemas'
import { dateTime } from '@petrik/shared/format'
import { del, get, post, put } from '../api.ts'
import { invalidateUsers } from '../data.ts'
import { useSession } from '../session.tsx'
import { Button, Card, Input, Label, PageHeader, Select, Table, useAction, useLoad } from '../ui.tsx'
import { useDialog } from '../dialog.tsx'

type Form = { id?: string; username: string; displayName: string; role: Role; password: string }
const blank: Form = { username: '', displayName: '', role: 'author', password: '' }

/** Accounts and their roles. A changed password logs the account out everywhere. */
export function UsersScreen() {
  const { user } = useSession()
  const { data, reload } = useLoad(() => get<{ users: Account[] }>('/users'), [])
  const [form, setForm] = useState<Form | null>(null)
  const action = useAction()
  const dialog = useDialog()

  const save = () =>
    form &&
    action.run(async () => {
      const body = { username: form.username, displayName: form.displayName, role: form.role, password: form.password }
      if (form.id) await put(`/users/${form.id}`, body)
      else await post('/users', body)
      invalidateUsers()
      setForm(null)
      reload()
    }, 'Fiók elmentve.')

  return (
    <div className="max-w-5xl">
      <PageHeader title="Fiókok">
        <Button tone="primary" onClick={() => setForm({ ...blank })}>
          + Új fiók
        </Button>
      </PageHeader>
      {action.view}
      {form && (
        <Card title={form.id ? 'Fiók szerkesztése' : 'Új fiók'} className="mb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label label="Név">
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </Label>
            <Label label="Felhasználónév" hint="Betűk, számok, pont, kötőjel, aláhúzás.">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
            </Label>
            <Label label="Szerep" hint={ROLE_DESCRIPTION[form.role]}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
            </Label>
            <Label label={form.id ? 'Új jelszó (üresen hagyva marad a régi)' : 'Kezdő jelszó'} hint={form.id === user?.id ? 'Legalább 10 karakter.' : 'Legalább 10 karakter. Első belépéskor új jelszót kell választania.'}>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </Label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button tone="primary" disabled={action.busy} onClick={save}>
              Mentés
            </Button>
            <Button onClick={() => setForm(null)}>Mégse</Button>
          </div>
        </Card>
      )}
      <Card>
        <Table head={['Név', 'Felhasználónév', 'Szerep', 'Létrehozva', '']}>
          {data?.users.map((account) => (
            <tr key={account.id}>
              <td className="px-2 py-2 font-medium">{account.displayName}</td>
              <td className="px-2 py-2 font-mono text-xs">{account.username}</td>
              <td className="px-2 py-2">
                {ROLE_LABEL[account.role] ?? account.role}
                {account.mustChangePassword && <span className="block text-xs text-amber-800">Jelszócsere szükséges</span>}
              </td>
              <td className="px-2 py-2 text-xs text-petrikfaint">{dateTime(account.createdAt)}</td>
              <td className="px-2 py-2 text-right">
                <Button tone="ghost" onClick={() => setForm({ id: account.id, username: account.username, displayName: account.displayName, role: account.role, password: '' })}>
                  Szerkesztés
                </Button>
                {account.id !== user?.id && (
                  <Button tone="ghost" onClick={async () => (await dialog.confirm({ title: 'Fiók törlése', message: `Törlöd ${account.displayName} fiókját? A hírei és oldalai megmaradnak, de ő többé nem tud belépni.`, confirmLabel: 'Fiók törlése', destructive: true })) && action.run(async () => (await del(`/users/${account.id}`), invalidateUsers(), reload()), 'Fiók törölve.')}>
                    Törlés
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
