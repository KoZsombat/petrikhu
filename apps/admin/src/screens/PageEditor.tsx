/**
 * The Creator's page editor: page data on top, then the blocks in order. Each block's form is generated from
 * its zod schema; blocks can be added, moved, collapsed and removed. Preview goes through the API.
 */
import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { BLOCK_LABELS, BLOCK_SCHEMAS, BLOCK_TYPES, blockId, blocksSchema } from '@petrik/shared/blocks'
import type { Block, BlockType } from '@petrik/shared/blocks'
import type { Page, PageSummary } from '@petrik/shared/schemas'
import { slugify } from '@petrik/shared/slug'
import { get, openPreview, post, put } from '../api.ts'
import { clean, defaultFor } from '../editor/schemaForm.tsx'
import { Field } from '../editor/schemaForm.tsx'
import { Button, Card, Input, Label, Notice, PageHeader, Select, Textarea, useAction, useLoad } from '../ui.tsx'
import { saveVersioned, useDialog } from '../dialog.tsx'
import { useUnsavedGuard } from '../unsaved.tsx'

type Draft = { slug: string; title: string; description: string; status: 'draft' | 'published'; locale: 'hu' | 'en'; translationOf: string | null; blocks: Block[] }

const newBlock = (type: BlockType): Block => ({ id: blockId(), type, props: defaultFor(BLOCK_SCHEMAS[type]) } as Block)

/** The blocks as they will be saved: empty optional fields dropped. */
const cleaned = (blocks: Block[]) => blocks.map((b) => ({ ...b, props: clean(BLOCK_SCHEMAS[b.type], b.props) }) as Block)

export function PageEditor() {
  const { id = 'uj' } = useParams()
  const isNew = id === 'uj'
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const action = useAction()
  const dialog = useDialog()
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)
  const loaded = useLoad(() => (isNew ? Promise.resolve(null) : get<{ page: Page }>(`/pages/${id}`).then((r) => r.page)), [id])
  const hungarian = useLoad(() => get<{ pages: PageSummary[] }>('/pages?locale=hu').then((r) => r.pages), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftFor, setDraftFor] = useState<string | null>(null)
  // The draft as loaded (or as a new page starts): what "unsaved changes" compares with.
  const [baseline, setBaseline] = useState<Draft | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<BlockType>('richText')
  const [slugTouched, setSlugTouched] = useState(false)

  const key = loaded.data ? `${loaded.data.id}:${loaded.data.updatedAt}` : isNew ? 'new' : null
  if (key && draftFor !== key) {
    setDraftFor(key)
    const page = loaded.data
    const initial: Draft = page
      ? { slug: page.slug, title: page.title, description: page.description, status: page.status === 'published' ? 'published' : 'draft', locale: page.locale, translationOf: page.translationOf, blocks: page.blocks }
      : { slug: '', title: '', description: '', status: 'draft', locale: params.get('locale') === 'en' ? 'en' : 'hu', translationOf: null, blocks: [newBlock('pageTitle')] }
    setDraft(initial)
    setBaseline(initial)
    if (!page) setOpen(new Set())
  }
  const guard = useUnsavedGuard(!!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline))
  if (!draft) return loaded.error ? <Notice tone="error">{loaded.error}</Notice> : null

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setBlocks = (blocks: Block[]) => set({ blocks })
  const toggle = (blockKey: string) => setOpen((s) => (s.has(blockKey) ? new Set([...s].filter((k) => k !== blockKey)) : new Set([...s, blockKey])))
  const move = (from: number, to: number) => {
    const next = [...draft.blocks]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setBlocks(next)
  }
  const body = () => ({ ...draft, slug: draft.slug || undefined, blocks: cleaned(draft.blocks) })

  async function save(status?: 'draft' | 'published') {
    const payload = { ...body(), ...(status ? { status } : {}) }
    const check = blocksSchema.safeParse(payload.blocks)
    if (!check.success) {
      const issue = check.error.issues[0]
      const block = payload.blocks[Number(issue.path[0])]
      action.setMessage({ tone: 'error', text: `Hiba a(z) ${Number(issue.path[0]) + 1}. blokkban (${block ? BLOCK_LABELS[block.type].label : ''}): ${issue.path.slice(2).join('.') || 'tartalom'} – kötelező vagy hibás mező.` })
      return
    }
    const success = status === 'published' ? 'Az oldal kint van a webhelyen.' : 'Elmentve.'
    await action.run(async () => {
      if (isNew) {
        const { page } = await post<{ page: Page }>('/pages', payload)
        guard.allowNext()
        navigate(`/oldalak/${page.id}`, { replace: true, state: { notice: success } })
        // /oldalak/uj and /oldalak/<id> are the same route: this component stays, so it shows the notice itself.
        action.setMessage({ tone: 'success', text: success })
        return
      }
      const saved = await saveVersioned(dialog, loaded.data!.version, (version) => put(`/pages/${id}`, { ...payload, version }), () => {
        setDraftFor(null)
        loaded.reload()
      })
      if (!saved) return
      loaded.reload()
      action.setMessage({ tone: 'success', text: success })
    })
  }

  const url = `${draft.locale === 'en' ? '/en/' : '/'}${draft.slug || slugify(draft.title, '')}`

  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? 'Új oldal' : draft.title || 'Oldal'}>
        <Button onClick={() => action.run(() => openPreview({ kind: 'page', page: body() }))}>Előnézet</Button>
        <Button disabled={action.busy} onClick={() => save('draft')}>
          {draft.status === 'published' && !isNew ? 'Visszavonás piszkozatba' : 'Mentés piszkozatként'}
        </Button>
        <Button tone="primary" disabled={action.busy} onClick={() => save('published')}>
          {draft.status === 'published' && !isNew ? 'Mentés (kint marad)' : 'Közzététel'}
        </Button>
      </PageHeader>
      {flash && !action.view && (
        <Notice tone="success" onClose={() => setFlash(null)}>
          {flash}
        </Notice>
      )}
      {action.view}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label label="Cím (böngészőfül, keresők)">
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value, ...(!slugTouched && isNew ? { slug: '' } : {}) })} />
          </Label>
          <Label label="Webcím" hint={`A lap címe: ${url}${!isNew && loaded.data?.status === 'published' && loaded.data.slug !== draft.slug && draft.slug ? ` – a régi cím (/${loaded.data.locale === 'en' ? 'en/' : ''}${loaded.data.slug}) átirányít ide.` : ''}`}>
            <Input
              value={draft.slug}
              placeholder={slugify(draft.title, '')}
              onChange={(e) => {
                setSlugTouched(true)
                set({ slug: e.target.value.toLowerCase() })
              }}
            />
          </Label>
          <Label label="Leírás (keresők, megosztás)">
            <Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </Label>
          {draft.locale === 'en' && (
            <Label label="Melyik magyar oldal fordítása?" hint="A nyelvváltó ezt a két oldalt köti össze.">
              <Select value={draft.translationOf ?? ''} onChange={(e) => set({ translationOf: e.target.value || null })}>
                <option value="">— nincs —</option>
                {hungarian.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (/{p.slug})
                  </option>
                ))}
              </Select>
            </Label>
          )}
        </div>
      </Card>

      <ol className="mt-5 space-y-3">
        {draft.blocks.map((block, i) => {
          const isOpen = open.has(block.id)
          return (
            <li key={block.id} className="rounded-xl border border-petriklinesoft bg-petrikcard">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => toggle(block.id)} aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-medium">{BLOCK_LABELS[block.type]?.label ?? block.type}</span>
                  <span className="truncate text-sm text-petrikfaint">{summary(block)}</span>
                </button>
                <Button tone="ghost" aria-label="Fel" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp size={14} />
                </Button>
                <Button tone="ghost" aria-label="Le" disabled={i === draft.blocks.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown size={14} />
                </Button>
                <Button tone="ghost" aria-label="Blokk törlése" onClick={async () => (await dialog.confirm({ title: 'Blokk törlése', message: `A(z) „${BLOCK_LABELS[block.type]?.label ?? block.type}” blokk kikerül az oldalból (mentésig visszavonható: töltsd újra az oldalt mentés nélkül).`, confirmLabel: 'Törlés', destructive: true })) && setBlocks(draft.blocks.filter((b) => b.id !== block.id))}>
                  <Trash2 size={14} />
                </Button>
              </div>
              {isOpen && (
                <div className="space-y-4 border-t border-petriklinesoft px-4 py-4">
                  <Field
                    schema={BLOCK_SCHEMAS[block.type]}
                    value={block.props}
                    onChange={(props) => setBlocks(draft.blocks.map((b) => (b.id === block.id ? ({ ...b, props } as Block) : b)))}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <Card className="mt-5">
        <div className="flex flex-wrap items-end gap-2">
          <Label label="Új blokk">
            <Select value={adding} onChange={(e) => setAdding(e.target.value as BlockType)}>
              {BLOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BLOCK_LABELS[type].label} – {BLOCK_LABELS[type].description}
                </option>
              ))}
            </Select>
          </Label>
          <Button
            tone="primary"
            onClick={() => {
              const block = newBlock(adding)
              setBlocks([...draft.blocks, block])
              setOpen((s) => new Set([...s, block.id]))
            }}
          >
            + Hozzáadás
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** A short hint next to a collapsed block's name. */
function summary(block: Block): string {
  const props = block.props as Record<string, unknown>
  for (const key of ['title', 'heading', 'label', 'eyebrow']) if (typeof props[key] === 'string' && props[key]) return String(props[key])
  if (Array.isArray(props.items)) return `${props.items.length} elem`
  return ''
}
