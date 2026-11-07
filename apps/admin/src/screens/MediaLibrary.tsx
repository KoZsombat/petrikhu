/**
 * The media library: uploaded images, uploaded documents (PDFs and the rest) and a cleanup view of the uploads
 * that nothing uses. A file still in use cannot be deleted: the server answers with the places, listed here.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { dateTime } from '@petrik/shared/format'
import { ApiError, del, get, upload } from '../api.ts'
import { useDialog } from '../dialog.tsx'
import { useSession } from '../session.tsx'
import { Button, Card, Empty, Notice, PageHeader, Pager, Table, cx, useAction, useLoad } from '../ui.tsx'

type Image = { id: string; url: string; size: number; width: number | null; height: number | null; createdAt: string }
type Document = { id: string; url: string; name: string; mime: string; size: number; createdAt: string; uploadedBy: string | null }
type Unused = { id: string; url: string; mime: string; size: number; createdAt: string; uploadedBy: string | null }

export type MediaUsage =
  | { kind: 'page' | 'post'; id: string; title: string; locale: string; status: string }
  | { kind: 'menu'; locale: string }
  | { kind: 'library' }
  | { kind: 'setting'; key: string }

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/** The places a file is used, with links to their editors. */
export function UsageList({ usages }: { usages: MediaUsage[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {usages.map((usage, i) => (
        <li key={i}>
          {usage.kind === 'page' && (
            <Link className="underline" to={`/oldalak/${usage.id}`}>
              Oldal: {usage.title} {usage.locale === 'en' ? '(angol)' : ''}
            </Link>
          )}
          {usage.kind === 'post' && (
            <Link className="underline" to={`/hirek/${usage.id}`}>
              Hír: {usage.title}
            </Link>
          )}
          {usage.kind === 'menu' && (
            <Link className="underline" to="/menu">
              {usage.locale === 'en' ? 'Angol menü' : 'Magyar menü'}
            </Link>
          )}
          {usage.kind === 'library' && (
            <Link className="underline" to="/dokumentumtar">
              Dokumentumtár
            </Link>
          )}
          {usage.kind === 'setting' && <span>Beállítás: {usage.key}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The usages of a refused delete (409 in_use), or null. */
export function usagesOf(error: unknown): MediaUsage[] | null {
  return error instanceof ApiError && error.code === 'in_use' ? ((error.body.usages as MediaUsage[]) ?? []) : null
}

type Tab = 'images' | 'documents' | 'unused'

export function MediaLibrary() {
  const { can } = useSession()
  const canDocuments = can('library.manage') || can('pages.manage')
  const [tab, setTab] = useState<Tab>('images')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'images', label: 'Képek' },
    ...(canDocuments ? [{ id: 'documents' as const, label: 'Dokumentumok' }, { id: 'unused' as const, label: 'Nem használt fájlok' }] : []),
  ]
  return (
    <div className="max-w-6xl">
      <PageHeader title="Médiatár" />
      <div role="tablist" aria-label="Médiatár" className="mb-4 flex gap-1 border-b border-petrikline">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx('-mb-px rounded-t-md border px-4 py-2 text-sm font-medium', tab === t.id ? 'border-petrikline border-b-petrikbg bg-petrikbg text-petrikink' : 'border-transparent text-petriksoft hover:text-petrikink')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'images' && <Images />}
      {tab === 'documents' && <Documents />}
      {tab === 'unused' && <UnusedFiles />}
    </div>
  )
}

/** Delete with a confirmation; a file in use shows where. */
function useDelete(reload: () => void) {
  const action = useAction()
  const dialog = useDialog()
  const [blocked, setBlocked] = useState<{ url: string; usages: MediaUsage[] } | null>(null)
  const remove = async (item: { id: string; url: string }, what: string) => {
    const ok = await dialog.confirm({
      title: `${what} végleges törlése`,
      message: (
        <>
          <p className="break-all font-mono text-xs">{item.url}</p>
          <p className="mt-2">A fájl azonnal elérhetetlenné válik a webhelyen. Ez nem vonható vissza.</p>
        </>
      ),
      confirmLabel: 'Végleges törlés',
      destructive: true,
    })
    if (!ok) return
    setBlocked(null)
    await action.run(async () => {
      try {
        await del(`/media/${item.id}`)
      } catch (error) {
        const usages = usagesOf(error)
        if (!usages) throw error
        setBlocked({ url: item.url, usages })
        return
      }
      reload()
      action.setMessage({ tone: 'success', text: `${what} törölve.` })
    })
  }
  const view = (
    <>
      {action.view}
      {blocked && (
        <Notice tone="warning" onClose={() => setBlocked(null)}>
          <strong>Nem törölhető, mert használatban van:</strong> <span className="break-all font-mono text-xs">{blocked.url}</span>
          <UsageList usages={blocked.usages} />
          <p className="mt-2 text-xs">Előbb vedd ki ezekből a helyekből, utána törölheted.</p>
        </Notice>
      )}
    </>
  )
  return { remove, view, busy: action.busy, action }
}

function Images() {
  const { can } = useSession()
  const [page, setPage] = useState(1)
  const { data, error, reload } = useLoad(() => get<{ items: Image[] }>(`/media?kind=images&page=${page}`), [page])
  const deleting = useDelete(reload)
  return (
    <>
      <div className="mb-4 flex justify-end">
        <label className="inline-flex cursor-pointer items-center rounded-md bg-petrikaccent px-3 py-1.5 text-sm font-medium text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-petrikaccent hover:bg-petrikaccentdark">
          Kép feltöltése
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              deleting.action.run(async () => {
                for (const file of files) await upload('/media', file)
                reload()
              }, `${files.length} kép feltöltve.`)
            }}
          />
        </label>
      </div>
      <Notice>A feltöltött képekből a szerver kisebb WebP és AVIF változatokat készít; a webhely ezeket tölti be. Legfeljebb 8 MB / kép.</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {deleting.view}
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
                  {size(item.size)} · {dateTime(item.createdAt)}
                </p>
                {can('pages.manage') && (
                  <Button tone="danger" className="w-full justify-center" disabled={deleting.busy} onClick={() => deleting.remove(item, 'Kép')}>
                    Törlés
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Pager page={page} totalPages={data && data.items.length === 100 ? page + 1 : page} onPage={setPage} />
      </Card>
    </>
  )
}

function Documents() {
  const [page, setPage] = useState(1)
  const { data, error, reload } = useLoad(() => get<{ items: Document[] }>(`/media?kind=documents&page=${page}`), [page])
  const deleting = useDelete(reload)
  return (
    <>
      <Notice>A dokumentumtárba feltöltött fájlok. Új dokumentumot a Dokumentumtár szerkesztőjében tölthetsz fel. A listában még szereplő fájl nem törölhető.</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {deleting.view}
      <Card>
        {data?.items.length === 0 ? (
          <Empty>Még nincs feltöltött dokumentum.</Empty>
        ) : (
          <Table head={['Név', 'Méret', 'Feltöltve', 'Feltöltötte', '']}>
            {data?.items.map((item) => (
              <tr key={item.id}>
                <td className="px-2 py-2">
                  <a href={item.url} target="_blank" rel="noreferrer" className="break-all font-mono text-xs hover:underline">
                    {item.name}
                  </a>
                </td>
                <td className="px-2 py-2 text-xs whitespace-nowrap">{size(item.size)}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap text-petrikfaint">{dateTime(item.createdAt)}</td>
                <td className="px-2 py-2 text-xs">{item.uploadedBy ?? '—'}</td>
                <td className="px-2 py-2 text-right">
                  <Button tone="danger" disabled={deleting.busy} onClick={() => deleting.remove(item, 'Dokumentum')}>
                    Törlés
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pager page={page} totalPages={data && data.items.length === 100 ? page + 1 : page} onPage={setPage} />
      </Card>
    </>
  )
}

function UnusedFiles() {
  const { can } = useSession()
  const { data, error, reload } = useLoad(() => get<{ items: Unused[] }>('/media/unused'), [])
  const deleting = useDelete(reload)
  return (
    <>
      <Notice>Feltöltött fájlok, amelyeket egyetlen oldal, hír, menü, a dokumentumtár és a beállítások sem használ. Törlés előtt nézd meg, nem hivatkozik-e rájuk máshonnan (pl. e-mail).</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      {deleting.view}
      <Card>
        {data?.items.length === 0 ? (
          <Empty>Nincs használaton kívüli fájl.</Empty>
        ) : (
          <Table head={['Fájl', 'Típus', 'Méret', 'Feltöltve', '']}>
            {data?.items.map((item) => (
              <tr key={item.id}>
                <td className="px-2 py-2">
                  <a href={item.url} target="_blank" rel="noreferrer" className="break-all font-mono text-xs hover:underline">
                    {item.url}
                  </a>
                </td>
                <td className="px-2 py-2 text-xs">{item.mime.split(';')[0]}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap">{size(item.size)}</td>
                <td className="px-2 py-2 text-xs text-petrikfaint">
                  {dateTime(item.createdAt)}
                  {item.uploadedBy ? ` · ${item.uploadedBy}` : ''}
                </td>
                <td className="px-2 py-2 text-right">
                  {(item.mime.startsWith('image/') ? can('pages.manage') : true) && (
                    <Button tone="danger" disabled={deleting.busy} onClick={() => deleting.remove(item, item.mime.startsWith('image/') ? 'Kép' : 'Dokumentum')}>
                      Törlés
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
