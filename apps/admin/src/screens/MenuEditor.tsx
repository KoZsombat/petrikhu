import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Menu, MenuItem } from '@petrik/shared/schemas'
import { menuSchema } from '@petrik/shared/schemas'
import { del, get, put } from '../api.ts'
import { Button, Card, Input, Notice, PageHeader, Select, useAction, useLoad } from '../ui.tsx'
import { saveVersioned, useDialog } from '../dialog.tsx'

type Editable = { label: string; href?: string; children?: { label: string; href: string }[] }

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** The main menu of each language: top-level links and groups with sub-links. */
export function MenuEditor() {
  const [locale, setLocale] = useState<'hu' | 'en'>('hu')
  const loaded = useLoad(() => get<{ menu: Menu; version: number }>(`/pages/menu/${locale}`), [locale])
  const [menu, setMenu] = useState<Editable[] | null>(null)
  const [menuFor, setMenuFor] = useState<unknown>(null)
  const action = useAction()
  const dialog = useDialog()
  if (loaded.data && menuFor !== loaded.data) {
    setMenuFor(loaded.data)
    setMenu(loaded.data.menu.map((item) => ({ ...item })))
  }
  if (!menu) return loaded.error ? <Notice tone="error">{loaded.error}</Notice> : null

  const update = (i: number, patch: Partial<Editable>) => setMenu(menu.map((item, j) => (j === i ? { ...item, ...patch } : item)))
  const save = () => {
    const parsed = menuSchema.safeParse(menu.map((item) => (item.children ? { label: item.label, children: item.children } : { label: item.label, href: item.href ?? '' })))
    if (!parsed.success) {
      action.setMessage({ tone: 'error', text: 'Minden menüpontnak kell felirat, és a linkek / -rel vagy https://-sel kezdődjenek, szóköz nélkül.' })
      return
    }
    return action.run(async () => {
      const saved = await saveVersioned(dialog, loaded.data!.version, (version) => put(`/pages/menu/${locale}`, { menu: parsed.data satisfies MenuItem[], version }), () => {
        setMenuFor(null)
        loaded.reload()
      })
      if (!saved) return
      loaded.reload()
      action.setMessage({ tone: 'success', text: 'Menü elmentve. A webhelyen azonnal látszik.' })
    })
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Menü">
        <Select value={locale} onChange={(e) => setLocale(e.target.value as 'hu' | 'en')} className="w-auto" aria-label="Nyelv">
          <option value="hu">Magyar menü</option>
          <option value="en">Angol menü</option>
        </Select>
        <Button onClick={() => window.confirm('Visszaállítod az eredeti menüt?') && action.run(async () => (await del(`/pages/menu/${locale}`), loaded.reload()), 'Visszaállítva.')}>
          Eredeti visszaállítása
        </Button>
        <Button tone="primary" disabled={action.busy} onClick={save}>
          Mentés
        </Button>
      </PageHeader>
      {action.view}
      <ol className="space-y-3">
        {menu.map((item, i) => (
          <li key={i}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-56" value={item.label} placeholder="Felirat" aria-label="Felirat" onChange={(e) => update(i, { label: e.target.value })} />
                {item.children ? (
                  <span className="text-sm text-petrikfaint">Lenyíló csoport</span>
                ) : (
                  <Input className="max-w-80" value={item.href ?? ''} placeholder="/oldal vagy https://…" aria-label="Link" onChange={(e) => update(i, { href: e.target.value })} />
                )}
                <span className="ml-auto flex gap-1">
                  <Button tone="ghost" onClick={() => update(i, item.children ? { children: undefined, href: '/' } : { children: [], href: undefined })}>
                    {item.children ? 'Legyen link' : 'Legyen csoport'}
                  </Button>
                  <Button tone="ghost" aria-label="Fel" disabled={i === 0} onClick={() => setMenu(moved(menu, i, i - 1))}><ArrowUp size={14} /></Button>
                  <Button tone="ghost" aria-label="Le" disabled={i === menu.length - 1} onClick={() => setMenu(moved(menu, i, i + 1))}><ArrowDown size={14} /></Button>
                  <Button tone="ghost" aria-label="Törlés" onClick={() => setMenu(menu.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </span>
              </div>
              {item.children && (
                <ol className="mt-3 space-y-2 border-l-2 border-petrikpale pl-4">
                  {item.children.map((child, c) => (
                    <li key={c} className="flex flex-wrap gap-2">
                      <Input className="max-w-56" value={child.label} placeholder="Felirat" aria-label="Almenü felirata" onChange={(e) => update(i, { children: item.children!.map((x, k) => (k === c ? { ...x, label: e.target.value } : x)) })} />
                      <Input className="max-w-80" value={child.href} placeholder="/oldal" aria-label="Almenü linkje" onChange={(e) => update(i, { children: item.children!.map((x, k) => (k === c ? { ...x, href: e.target.value } : x)) })} />
                      <Button tone="ghost" aria-label="Fel" disabled={c === 0} onClick={() => update(i, { children: moved(item.children!, c, c - 1) })}><ArrowUp size={14} /></Button>
                      <Button tone="ghost" aria-label="Le" disabled={c === item.children!.length - 1} onClick={() => update(i, { children: moved(item.children!, c, c + 1) })}><ArrowDown size={14} /></Button>
                      <Button tone="ghost" aria-label="Törlés" onClick={() => update(i, { children: item.children!.filter((_, k) => k !== c) })}><Trash2 size={14} /></Button>
                    </li>
                  ))}
                  <li>
                    <Button onClick={() => update(i, { children: [...item.children!, { label: '', href: '/' }] })}>
                      <Plus size={14} /> Almenüpont
                    </Button>
                  </li>
                </ol>
              )}
            </Card>
          </li>
        ))}
      </ol>
      <Button className="mt-3" onClick={() => setMenu([...menu, { label: '', href: '/' }])}>
        <Plus size={14} /> Menüpont
      </Button>
    </div>
  )
}
