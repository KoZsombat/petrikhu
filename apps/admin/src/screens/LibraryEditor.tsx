import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Library } from '@petrik/shared/schemas'
import { librarySchema } from '@petrik/shared/schemas'
import { slugify } from '@petrik/shared/slug'
import { ApiError, del, get, put, upload } from '../api.ts'
import { UsageList, usagesOf } from './MediaLibrary.tsx'
import type { MediaUsage } from './MediaLibrary.tsx'
import { Button, Card, Input, Notice, PageHeader, useAction, useLoad } from '../ui.tsx'
import { saveVersioned, useDialog } from '../dialog.tsx'
import { useUnsavedGuard } from '../unsaved.tsx'

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** A unique slug from a title among the ones already used. */
function freshSlug(title: string, used: Set<string>): string {
  const base = slugify(title, 'dokumentum')
  let slug = base
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
  return slug
}

/** The document library: categories with documents (uploaded file, external link, or listed without a file). */
export function LibraryEditor() {
  const loaded = useLoad(() => get<{ library: Library; version: number }>('/library'), [])
  const [library, setLibrary] = useState<Library | null>(null)
  const [libraryFor, setLibraryFor] = useState<unknown>(null)
  const action = useAction()
  const dialog = useDialog()
  // Uploaded files the editor chose to delete with their list entry: deleted after the next successful save
  // (until then the stored library still lists them, which counts as a use).
  const [toDelete, setToDelete] = useState<string[]>([])
  const [blocked, setBlocked] = useState<{ url: string; usages: MediaUsage[] }[]>([])
  if (loaded.data && libraryFor !== loaded.data) {
    setLibraryFor(loaded.data)
    setLibrary(structuredClone(loaded.data.library))
  }
  useUnsavedGuard(!!library && !!loaded.data && libraryFor === loaded.data && (JSON.stringify(library) !== JSON.stringify(loaded.data.library) || toDelete.length > 0))
  if (!library) return loaded.error ? <Notice tone="error">{loaded.error}</Notice> : null

  const used = () => new Set(library.categories.flatMap((c) => [c.slug, ...c.docs.map((d) => d.slug)]))
  const setCategory = (i: number, patch: Partial<Library['categories'][number]>) => setLibrary({ categories: library.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const save = () => {
    const parsed = librarySchema.safeParse(library)
    if (!parsed.success) {
      action.setMessage({ tone: 'error', text: 'Minden kategóriának és dokumentumnak kell cím, és a fájl címe /uploads/, /media/ vagy https:// legyen.' })
      return
    }
    return action.run(async () => {
      const saved = await saveVersioned(dialog, loaded.data!.version, (version) => put('/library', { library: parsed.data, version }), () => {
        setLibraryFor(null)
        loaded.reload()
      })
      if (!saved) return
      // Files removed from the list on purpose: delete them now that the list no longer has them.
      const stillListed = new Set(parsed.data.categories.flatMap((c) => c.docs.map((d) => d.file)))
      const failed: { url: string; usages: MediaUsage[] }[] = []
      let deleted = 0
      for (const url of toDelete.filter((u) => !stillListed.has(u))) {
        try {
          const { item } = await get<{ item: { id: string } }>(`/media/lookup?path=${encodeURIComponent(url)}`)
          await del(`/media/${item.id}`)
          deleted += 1
        } catch (error) {
          const usages = usagesOf(error)
          if (usages) failed.push({ url, usages })
          else if (!(error instanceof ApiError && error.status === 404)) failed.push({ url, usages: [] })
        }
      }
      setToDelete([])
      setBlocked(failed)
      loaded.reload()
      action.setMessage({ tone: 'success', text: deleted ? `Dokumentumtár elmentve, ${deleted} fájl törölve a szerverről.` : 'Dokumentumtár elmentve.' })
    })
  }

  /** Removes a document from the list; an uploaded file may also be deleted from the server (at the next save). */
  async function removeDoc(i: number, d: number) {
    const category = library!.categories[i]
    const doc = category.docs[d]
    const uploaded = doc.file?.startsWith('/uploads/')
    const result = await dialog.ask({
      title: 'Dokumentum eltávolítása a listából',
      message: (
        <>
          <p>
            „{doc.title}” kikerül a(z) „{category.title}” kategóriából.
          </p>
          {uploaded && <p className="mt-2">A feltöltött fájl a listából való törlés után is letölthető marad a címéről, hacsak nem törlöd a szerverről is.</p>}
        </>
      ),
      option: uploaded ? { label: 'A fájlt is törlöm a szerverről (mentéskor; nem vonható vissza)', defaultChecked: true } : undefined,
      choices: [{ label: 'Eltávolítás', value: true, tone: 'danger' }],
    })
    if (!result) return
    setCategory(i, { docs: category.docs.filter((_, k) => k !== d) })
    if (uploaded && result.option) setToDelete((list) => [...new Set([...list, doc.file!])])
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Dokumentumtár">
        <Button onClick={async () => (await dialog.confirm({ title: 'Eredeti dokumentumtár visszaállítása', message: 'A dokumentumtár minden módosítása elvész, és a webhelyen azonnal az eredeti lista jelenik meg. A feltöltött fájlok megmaradnak a Médiatárban.', confirmLabel: 'Visszaállítás', destructive: true })) && action.run(async () => (await del('/library'), loaded.reload()), 'Visszaállítva.')}>Eredeti visszaállítása</Button>
        <Button tone="primary" disabled={action.busy} onClick={save}>
          Mentés
        </Button>
      </PageHeader>
      {action.view}
      {toDelete.length > 0 && (
        <Notice tone="warning">
          Mentéskor ezek a fájlok a szerverről is törlődnek:
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {toDelete.map((url) => (
              <li key={url} className="break-all">
                {url}{' '}
                <button type="button" className="font-sans text-xs underline" onClick={() => setToDelete(toDelete.filter((u) => u !== url))}>
                  mégse
                </button>
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {blocked.map((b) => (
        <Notice key={b.url} tone="warning" onClose={() => setBlocked(blocked.filter((x) => x !== b))}>
          <strong>Nem törölhető a szerverről:</strong> <span className="break-all font-mono text-xs">{b.url}</span>
          {b.usages.length > 0 ? <UsageList usages={b.usages} /> : <p>A törlés nem sikerült; próbáld a Médiatárban.</p>}
        </Notice>
      ))}
      <div className="space-y-4">
        {library.categories.map((category, i) => (
          <Card key={category.slug}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input className="max-w-md font-semibold" value={category.title} aria-label="Kategória neve" onChange={(e) => setCategory(i, { title: e.target.value })} />
              <span className="ml-auto flex gap-1">
                <Button tone="ghost" aria-label="Fel" disabled={i === 0} onClick={() => setLibrary({ categories: moved(library.categories, i, i - 1) })}><ArrowUp size={14} /></Button>
                <Button tone="ghost" aria-label="Le" disabled={i === library.categories.length - 1} onClick={() => setLibrary({ categories: moved(library.categories, i, i + 1) })}><ArrowDown size={14} /></Button>
                <Button tone="ghost" aria-label="Kategória törlése" onClick={async () => (await dialog.confirm({ title: 'Kategória törlése', message: `A(z) „${category.title}” kategória és a benne lévő ${category.docs.length} dokumentum kikerül a listából (a fájlok a Médiatárban maradnak).`, confirmLabel: 'Törlés', destructive: true })) && setLibrary({ categories: library.categories.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button>
              </span>
            </div>
            <ol className="space-y-2">
              {category.docs.map((doc, d) => (
                <li key={doc.slug} className="flex flex-wrap items-center gap-2">
                  <Input className="max-w-sm" value={doc.title} aria-label="Dokumentum címe" onChange={(e) => setCategory(i, { docs: category.docs.map((x, k) => (k === d ? { ...x, title: e.target.value } : x)) })} />
                  <Input className="max-w-xs font-mono text-xs" value={doc.file ?? ''} placeholder="nincs fájl (védett)" aria-label="Fájl" onChange={(e) => setCategory(i, { docs: category.docs.map((x, k) => (k === d ? { ...x, file: e.target.value || undefined } : x)) })} />
                  <label className="cursor-pointer rounded-md border border-petrikline px-2 py-1.5 text-xs hover:border-petrikaccent">
                    Fájl feltöltése
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) action.run(async () => {
                          const { url } = await upload('/library/file', file)
                          setCategory(i, { docs: category.docs.map((x, k) => (k === d ? { ...x, file: url } : x)) })
                        }, 'Feltöltve. Ne felejtsd el menteni.')
                      }}
                    />
                  </label>
                  <Button tone="ghost" aria-label="Fel" disabled={d === 0} onClick={() => setCategory(i, { docs: moved(category.docs, d, d - 1) })}><ArrowUp size={14} /></Button>
                  <Button tone="ghost" aria-label="Le" disabled={d === category.docs.length - 1} onClick={() => setCategory(i, { docs: moved(category.docs, d, d + 1) })}><ArrowDown size={14} /></Button>
                  <Button tone="ghost" aria-label="Törlés" onClick={() => removeDoc(i, d)}><Trash2 size={14} /></Button>
                </li>
              ))}
            </ol>
            <Button className="mt-2" onClick={() => setCategory(i, { docs: [...category.docs, { slug: freshSlug('uj-dokumentum', used()), title: 'Új dokumentum' }] })}>
              <Plus size={14} /> Dokumentum
            </Button>
          </Card>
        ))}
      </div>
      <Button className="mt-3" onClick={() => setLibrary({ categories: [...library.categories, { slug: freshSlug('uj-kategoria', used()), title: 'Új kategória', docs: [] }] })}>
        <Plus size={14} /> Kategória
      </Button>
    </div>
  )
}
