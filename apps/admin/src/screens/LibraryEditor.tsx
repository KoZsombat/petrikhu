import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Library } from '@petrik/shared/schemas'
import { librarySchema } from '@petrik/shared/schemas'
import { slugify } from '@petrik/shared/slug'
import { del, get, put, upload } from '../api.ts'
import { Button, Card, Input, Notice, PageHeader, useAction, useLoad } from '../ui.tsx'
import { saveVersioned, useDialog } from '../dialog.tsx'

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
  if (loaded.data && libraryFor !== loaded.data) {
    setLibraryFor(loaded.data)
    setLibrary(structuredClone(loaded.data.library))
  }
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
      loaded.reload()
      action.setMessage({ tone: 'success', text: 'Dokumentumtár elmentve.' })
    })
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Dokumentumtár">
        <Button onClick={() => window.confirm('Visszaállítod az eredeti dokumentumtárat?') && action.run(async () => (await del('/library'), loaded.reload()), 'Visszaállítva.')}>Eredeti visszaállítása</Button>
        <Button tone="primary" disabled={action.busy} onClick={save}>
          Mentés
        </Button>
      </PageHeader>
      {action.view}
      <div className="space-y-4">
        {library.categories.map((category, i) => (
          <Card key={category.slug}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input className="max-w-md font-semibold" value={category.title} aria-label="Kategória neve" onChange={(e) => setCategory(i, { title: e.target.value })} />
              <span className="ml-auto flex gap-1">
                <Button tone="ghost" aria-label="Fel" disabled={i === 0} onClick={() => setLibrary({ categories: moved(library.categories, i, i - 1) })}><ArrowUp size={14} /></Button>
                <Button tone="ghost" aria-label="Le" disabled={i === library.categories.length - 1} onClick={() => setLibrary({ categories: moved(library.categories, i, i + 1) })}><ArrowDown size={14} /></Button>
                <Button tone="ghost" aria-label="Kategória törlése" onClick={() => window.confirm('Törlöd a kategóriát és a benne lévő dokumentumokat a listából?') && setLibrary({ categories: library.categories.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button>
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
                  <Button tone="ghost" aria-label="Törlés" onClick={() => setCategory(i, { docs: category.docs.filter((_, k) => k !== d) })}><Trash2 size={14} /></Button>
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
