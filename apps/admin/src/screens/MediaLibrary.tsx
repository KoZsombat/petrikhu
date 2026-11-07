import { useState } from 'react'
import { dateTime } from '@petrik/shared/format'
import { del, get, upload } from '../api.ts'
import { useSession } from '../session.tsx'
import { Button, Card, Empty, Notice, PageHeader, Pager, useAction, useLoad } from '../ui.tsx'

type Item = { id: string; url: string; size: number; width: number | null; height: number | null; createdAt: string }

export function MediaLibrary() {
  const { can } = useSession()
  const [page, setPage] = useState(1)
  const { data, error, reload } = useLoad(() => get<{ items: Item[] }>(`/media?page=${page}`), [page])
  const action = useAction()

  return (
    <div className="max-w-6xl">
      <PageHeader title="Médiatár">
        <label className="inline-flex cursor-pointer items-center rounded-md bg-petrikaccent px-3 py-1.5 text-sm font-medium text-white hover:bg-petrikaccentdark">
          Kép feltöltése
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              action.run(async () => {
                for (const file of files) await upload('/media', file)
                reload()
              }, `${files.length} kép feltöltve.`)
            }}
          />
        </label>
      </PageHeader>
      <Notice>A feltöltött képekből a szerver kisebb WebP és AVIF változatokat készít; a webhely ezeket tölti be. Legfeljebb 8 MB / kép.</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {action.view}
      <Card>
        {data?.items.length === 0 && <Empty>Még nincs feltöltött kép.</Empty>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          {data?.items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-lg border border-petriklinesoft">
              <img src={/\.svg$/i.test(item.url) ? item.url : `${item.url}?w=480&f=webp`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              <div className="space-y-1 p-2 text-xs">
                <input readOnly value={item.url} onFocus={(e) => e.target.select()} className="w-full truncate rounded border border-petriklinesoft px-1 font-mono" aria-label="Kép címe" />
                <p className="text-petrikfaint">
                  {item.width ? `${item.width}×${item.height} · ` : ''}
                  {Math.round(item.size / 1024)} KB · {dateTime(item.createdAt)}
                </p>
                {can('pages.manage') && (
                  <Button tone="danger" className="w-full justify-center" onClick={() => window.confirm('Törlöd a képet? Ahol használják, ott eltűnik.') && action.run(async () => (await del(`/media/${item.id}`), reload()), 'Kép törölve.')}>
                    Törlés
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Pager page={page} totalPages={data && data.items.length === 100 ? page + 1 : page} onPage={setPage} />
      </Card>
    </div>
  )
}
