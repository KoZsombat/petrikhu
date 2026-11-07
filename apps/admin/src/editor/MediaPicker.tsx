import { useState } from 'react'
import { get, upload } from '../api.ts'
import { Button, Notice, useLoad } from '../ui.tsx'

type Item = { id: string; url: string; width: number | null; height: number | null }

/** A modal: pick an uploaded image or upload a new one. */
export function MediaPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const { data, error, reload } = useLoad(() => get<{ items: Item[] }>('/media'), [])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setUploadError(null)
    try {
      const { url } = await upload('/media', file)
      onPick(url)
    } catch (e) {
      setUploadError((e as Error).message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Kép kiválasztása" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-petrikcard p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Kép kiválasztása</h2>
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-transparent bg-petrikaccent px-3 py-1.5 text-sm font-medium text-white hover:bg-petrikaccentdark">
              {busy ? 'Feltöltés…' : 'Új kép feltöltése'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
            </label>
            <Button onClick={onClose}>Mégse</Button>
          </div>
        </div>
        {(error || uploadError) && <Notice tone="error">{uploadError ?? error}</Notice>}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {data?.items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item.url)} className="block w-full overflow-hidden rounded-md border border-petriklinesoft hover:border-petrikaccent">
                <img src={/\.svg$/i.test(item.url) ? item.url : `${item.url}?w=480&f=webp`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
