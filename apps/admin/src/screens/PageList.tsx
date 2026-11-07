import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { PageSummary } from '@petrik/shared/schemas'
import { dateTime } from '@petrik/shared/format'
import { del, get, post } from '../api.ts'
import { useUserNames } from '../data.ts'
import { Button, Card, Empty, Notice, PageHeader, Select, StatusBadge, Table, useAction, useLoad } from '../ui.tsx'
import { useDialog } from '../dialog.tsx'

export function PageList() {
  const [locale, setLocale] = useState<'hu' | 'en'>('hu')
  const navigate = useNavigate()
  const names = useUserNames()
  const { data, error, reload } = useLoad(() => get<{ pages: PageSummary[] }>(`/pages?locale=${locale}`), [locale])
  const action = useAction()
  const dialog = useDialog()
  const live = data?.pages.filter((p) => p.status !== 'trash') ?? []
  const trash = data?.pages.filter((p) => p.status === 'trash') ?? []
  const url = (p: PageSummary) => (p.locale === 'en' ? `/en/${p.slug}` : `/${p.slug}`)

  return (
    <div className="max-w-5xl">
      <PageHeader title="Oldalak">
        <Select value={locale} onChange={(e) => setLocale(e.target.value as 'hu' | 'en')} aria-label="Nyelv" className="w-auto">
          <option value="hu">Magyar oldalak</option>
          <option value="en">Angol oldalak</option>
        </Select>
        <Button tone="primary" onClick={() => navigate(`/oldalak/uj?locale=${locale}`)}>
          + Új oldal
        </Button>
      </PageHeader>
      {error && <Notice tone="error">{error}</Notice>}
      {action.view}
      <Card>
        {live.length === 0 ? (
          <Empty>Nincs oldal.</Empty>
        ) : (
          <Table head={['Cím', 'Webcím', 'Állapot', 'Módosítva', '']}>
            {live.map((p) => (
              <tr key={p.id}>
                <td className="px-2 py-2">
                  <Link to={`/oldalak/${p.id}`} className="font-medium hover:text-petrikaccentdark hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-2 py-2 font-mono text-xs">
                  {p.status === 'published' ? (
                    <a href={url(p)} target="_blank" rel="noreferrer" className="hover:underline">
                      {url(p)}
                    </a>
                  ) : (
                    url(p)
                  )}
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-2 py-2 text-xs text-petrikfaint">
                  {dateTime(p.updatedAt)} · {names(p.updatedById)}
                </td>
                <td className="px-2 py-2 text-right">
                  <Button tone="ghost" onClick={async () => (await dialog.confirm({ title: 'Oldal a lomtárba', message: `A(z) „${p.title}” oldal a lomtárba kerül, és lekerül a webhelyről. Később visszaállíthatod.`, confirmLabel: 'Lomtárba' })) && action.run(async () => (await del(`/pages/${p.id}`), reload()), 'Lomtárba helyezve.')}>
                    Lomtárba
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Lomtár" className="mt-5">
        {trash.length === 0 ? (
          <Empty>A lomtár üres.</Empty>
        ) : (
          <ul className="divide-y divide-petriklinesoft">
            {trash.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {p.title} <span className="font-mono text-xs text-petrikfaint">{url(p)}</span>
                </span>
                <span className="flex gap-2">
                  <Button onClick={() => action.run(async () => (await post(`/pages/${p.id}/restore`), reload()), 'Visszaállítva piszkozatként.')}>Visszaállítás</Button>
                  <Button tone="danger" onClick={async () => (await dialog.confirm({ title: 'Végleges törlés', message: `A(z) „${p.title}” oldal véglegesen törlődik. Ez nem vonható vissza.`, confirmLabel: 'Végleges törlés', destructive: true })) && action.run(async () => (await del(`/pages/${p.id}`), reload()), 'Véglegesen törölve.')}>
                    Végleges törlés
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
