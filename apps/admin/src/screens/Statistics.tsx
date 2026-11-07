import { get } from '../api.ts'
import { Card, Notice, PageHeader, useLoad } from '../ui.tsx'

type Stats = {
  published: number
  scheduled: number
  inReview: number
  archived: number
  monthPublished: number
  averageApprovalSeconds: number
  monthlyChart: { key: string; count: number }[]
  topAuthors: { name: string; count: number }[]
  topCategories: { name: string; count: number }[]
}

const duration = (seconds: number) => (seconds >= 86400 ? `${(seconds / 86400).toFixed(1)} nap` : seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} óra` : `${Math.round(seconds / 60)} perc`)

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3rem] items-center gap-2">
          <span className="truncate">{row.label}</span>
          <span className="h-3 rounded bg-petrikpale" style={{ width: `${(row.count / max) * 100}%` }} />
          <span className="text-right font-mono text-xs">{row.count}</span>
        </li>
      ))}
    </ul>
  )
}

export function Statistics() {
  const { data, error } = useLoad(() => get<Stats>('/statistics'), [])
  if (error) return <Notice tone="error">{error}</Notice>
  if (!data) return null
  const tiles: [string, string | number][] = [
    ['Kint lévő hír', data.published],
    ['Időzítve', data.scheduled],
    ['Jóváhagyásra vár', data.inReview],
    ['Archiválva', data.archived],
    ['Ebben a hónapban', data.monthPublished],
    ['Átlagos jóváhagyási idő', data.averageApprovalSeconds ? duration(data.averageApprovalSeconds) : '—'],
  ]
  return (
    <div className="max-w-5xl">
      <PageHeader title="Statisztika" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-petriklinesoft bg-petrikcard p-4">
            <p className="font-display text-3xl font-bold text-petrikaccentdark">{value}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-petrikfaint">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Megjelent hírek havonta">
          <Bars rows={data.monthlyChart.map((m) => ({ label: m.key, count: m.count }))} />
        </Card>
        <Card title="Legaktívabb szerzők">
          <Bars rows={data.topAuthors.map((a) => ({ label: a.name, count: a.count }))} />
        </Card>
        <Card title="Kategóriák">
          <Bars rows={data.topCategories.map((c) => ({ label: c.name, count: c.count }))} />
        </Card>
      </div>
    </div>
  )
}
