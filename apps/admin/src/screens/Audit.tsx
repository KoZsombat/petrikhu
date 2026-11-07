import { useState } from 'react'
import { Link } from 'react-router'
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, AUDIT_ENTITY_TYPES, STATUS_LABEL } from '@petrik/shared/workflow'
import type { PostStatus } from '@petrik/shared/workflow'
import { dateTime } from '@petrik/shared/format'
import { get } from '../api.ts'
import { Card, Input, Label, Notice, PageHeader, Pager, Select, Table, useLoad } from '../ui.tsx'

type Entry = { id: string; createdAt: string; userId: string | null; userName: string | null; entityType: string; entityId: string | null; subject: string | null; action: string; fromStatus: string | null; toStatus: string | null; note: string | null }

const status = (s: string | null) => (s ? (STATUS_LABEL[s as PostStatus] ?? s) : '')

/** Who did what to which entity, newest first, with filters. */
export function AuditScreen() {
  const [filters, setFilters] = useState({ entityType: '', userId: '', action: '', from: '', to: '', imported: false })
  const [page, setPage] = useState(1)
  const users = useLoad(() => get<{ users: { id: string; displayName: string }[] }>('/users'), [])
  const query = new URLSearchParams({ page: String(page), limit: '50', entityType: filters.entityType, userId: filters.userId, action: filters.action, from: filters.from, to: filters.to ? `${filters.to}T23:59:59` : '', imported: filters.imported ? '1' : '' })
  const { data, error } = useLoad(() => get<{ entries: Entry[]; totalPages: number; total: number }>(`/audit?${query}`), [query.toString()])
  const set = (patch: Partial<typeof filters>) => {
    setPage(1)
    setFilters({ ...filters, ...patch })
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Napló" />
      {error && <Notice tone="error">{error}</Notice>}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Label label="Tárgy">
            <Select value={filters.entityType} onChange={(e) => set({ entityType: e.target.value })}>
              <option value="">Mind</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AUDIT_ENTITY_LABEL[t]}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Ki">
            <Select value={filters.userId} onChange={(e) => set({ userId: e.target.value })}>
              <option value="">Bárki</option>
              {users.data?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Esemény">
            <Select value={filters.action} onChange={(e) => set({ action: e.target.value })}>
              <option value="">Mind</option>
              {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Ettől">
            <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
          </Label>
          <Label label="Eddig">
            <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
          </Label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={filters.imported} onChange={(e) => set({ imported: e.target.checked })} />
            Importált bejegyzések is
          </label>
        </div>
      </Card>
      <Card>
        {data && <p className="mb-2 text-xs text-petrikfaint">{data.total} bejegyzés</p>}
        <Table head={['Mikor', 'Ki', 'Mi', 'Esemény', 'Megjegyzés']}>
          {data?.entries.map((e) => (
            <tr key={e.id} className="align-top">
              <td className="whitespace-nowrap px-2 py-2 text-xs text-petrikfaint">{dateTime(e.createdAt)}</td>
              <td className="px-2 py-2">{e.userName ?? (e.userId ? '—' : 'rendszer')}</td>
              <td className="px-2 py-2">
                <span className="text-xs text-petrikfaint">{AUDIT_ENTITY_LABEL[e.entityType as keyof typeof AUDIT_ENTITY_LABEL] ?? e.entityType}: </span>
                {e.entityType === 'post' && e.entityId ? (
                  <Link to={`/hirek/${e.entityId}`} className="hover:underline">
                    {e.subject ?? e.entityId}
                  </Link>
                ) : e.entityType === 'page' && e.entityId ? (
                  <Link to={`/oldalak/${e.entityId}`} className="hover:underline">
                    {e.subject ?? e.entityId}
                  </Link>
                ) : (
                  (e.subject ?? '')
                )}
              </td>
              <td className="px-2 py-2">
                {AUDIT_ACTION_LABEL[e.action] ?? e.action}
                {(e.fromStatus || e.toStatus) && (
                  <span className="block text-xs text-petrikfaint">
                    {status(e.fromStatus)} → {status(e.toStatus)}
                  </span>
                )}
              </td>
              <td className="whitespace-pre-line px-2 py-2 text-xs text-petriksoft">{e.note}</td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
      </Card>
    </div>
  )
}
