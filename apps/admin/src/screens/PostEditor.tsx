/**
 * Writing and reviewing a news post. What can be done depends on the post's status and the user's
 * capabilities: the author saves / submits a draft; a reviewer edits, approves (now or scheduled) or rejects
 * with a message; a manager edits or archives a published post. The post's history is shown below.
 */
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { emptyDoc } from '@petrik/shared/tiptap'
import type { RichDoc } from '@petrik/shared/tiptap'
import type { Post, PostSaveBody } from '@petrik/shared/schemas'
import { AUDIT_ACTION_LABEL, canDecidePost, canEditPost, canTrashPost } from '@petrik/shared/workflow'
import { dateTime } from '@petrik/shared/format'
import { del, get, openPreview, post, put } from '../api.ts'
import { useTerms, useUserNames } from '../data.ts'
import { MediaPicker } from '../editor/MediaPicker.tsx'
import { RichEditor } from '../editor/RichEditor.tsx'
import { useSession } from '../session.tsx'
import { saveVersioned, useDialog } from '../dialog.tsx'
import { Button, Card, Input, Label, Notice, PageHeader, StatusBadge, Textarea, useAction, useLoad } from '../ui.tsx'

type Form = Required<Pick<PostSaveBody, 'title' | 'excerpt' | 'categoryIds' | 'tagIds' | 'imagePosition'>> & { content: RichDoc; featuredImage: string | null }

const blank = (): Form => ({ title: '', excerpt: '', content: emptyDoc(), categoryIds: [], tagIds: [], featuredImage: null, imagePosition: 'top' })
const fromPost = (p: Post): Form => ({ title: p.title, excerpt: p.excerpt, content: p.content, categoryIds: p.categoryIds, tagIds: p.tagIds, featuredImage: p.featuredImage, imagePosition: p.imagePosition })

const NOTICES: Record<string, string> = {
  draft_saved: 'Piszkozat elmentve.',
  submitted: 'Jóváhagyásra beküldve.',
  review_saved: 'Módosítások elmentve.',
  published_updated: 'A publikált hír frissítve.',
  approved: 'Jóváhagyva és publikálva.',
  scheduled: 'Jóváhagyva és időzítve.',
  rejected: 'Visszaküldve a szerzőnek.',
  trashed: 'Lomtárba helyezve.',
  untrashed: 'Visszaállítva piszkozatként.',
  published_archived: 'Archiválva.',
  archived_restored: 'Visszaállítva és újrapublikálva.',
  scheduled_saved: 'Módosítások elmentve; az időzítés nem változott.',
  rescheduled: 'Módosítások és az új időzítés elmentve.',
  unscheduled: 'Időzítés visszavonva; a hír újra jóváhagyásra vár.',
}

/** An ISO time as the value of a datetime-local input (local time, minutes). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PostEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { user, can } = useSession()
  const names = useUserNames()
  const { terms, refresh: refreshTerms } = useTerms()
  const loaded = useLoad(() => (id ? get<{ post: Post }>(`/posts/${id}`).then((r) => r.post) : Promise.resolve(null)), [id])
  const history = useLoad(() => (id ? get<{ entries: { id: string; action: string; createdAt: string; userName: string | null; note: string | null }[] }>(`/posts/${id}/audit`) : Promise.resolve({ entries: [] })), [id, loaded.data?.updatedAt, loaded.data?.status])
  const [form, setForm] = useState<Form>(blank)
  const [formFor, setFormFor] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [note, setNote] = useState('')
  const [publishAt, setPublishAt] = useState('')
  // A scheduled post's time, editable by a reviewer (follows the loaded post).
  const [scheduleAt, setScheduleAt] = useState('')
  const [newTerm, setNewTerm] = useState('')
  const action = useAction()
  const dialog = useDialog()
  // A notice handed over by the previous screen (a new post saves, then opens at its own address).
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)

  const current = loaded.data ?? null
  // The form follows the loaded post (also after a save reloads it).
  const key = current ? `${current.id}:${current.updatedAt}` : 'new'
  if (formFor !== key && (isNew || current)) {
    setFormFor(key)
    setForm(current ? fromPost(current) : blank())
    setScheduleAt(toLocalInput(current?.scheduledFor ?? null))
  }

  if (!isNew && !current) return loaded.error ? <Notice tone="error">{loaded.error}</Notice> : null
  const status = current?.status ?? 'draft'
  const editable = isNew || (!!user && !!current && canEditPost(current, user))
  const set = <K extends keyof Form>(field: K, value: Form[K]) => setForm((f) => ({ ...f, [field]: value }))
  const toggle = (field: 'categoryIds' | 'tagIds', termId: string) => set(field, form[field].includes(termId) ? form[field].filter((x) => x !== termId) : [...form[field], termId])

  /** Saves the form (PUT with the loaded version); a conflict asks whether to reload or overwrite. */
  async function saveExisting(command: 'draft' | 'submit') {
    const moved = current?.status === 'scheduled' && scheduleAt && scheduleAt !== toLocalInput(current.scheduledFor)
    const body = { ...form, command, ...(moved ? { publishAt: new Date(scheduleAt).toISOString() } : {}) }
    return saveVersioned(dialog, current!.version, (version) => put<{ post: Post; notice: string }>(`/posts/${id}`, { ...body, version }), () => {
      setFormFor(null)
      loaded.reload()
    })
  }

  async function save(command: 'draft' | 'submit') {
    await action.run(async () => {
      if (isNew) {
        const res = await post<{ post: Post; notice: string }>('/posts', { ...form, command })
        navigate(`/hirek/${res.post.id}`, { replace: true, state: { notice: NOTICES[res.notice] } })
      } else {
        const res = await saveExisting(command)
        if (!res) return
        loaded.reload()
        action.setMessage({ tone: 'success', text: NOTICES[res.notice] })
      }
    })
  }

  async function simple(path: string, method: 'post' | 'del' = 'post', after?: () => void) {
    await action.run(async () => {
      const res = method === 'post' ? await post<{ notice: string }>(path) : await del<{ notice: string; permanent?: boolean }>(path)
      action.setMessage({ tone: 'success', text: NOTICES[res.notice] ?? 'Kész.' })
      if (after) after()
      else loaded.reload()
    })
  }

  async function decide(decision: 'approve' | 'reject' | 'schedule') {
    await action.run(async () => {
      const body =
        decision === 'reject'
          ? { decision: 'reject', note }
          : decision === 'schedule'
            ? { decision: 'approve', note, publishAt: publishAt ? new Date(publishAt).toISOString() : '' }
            : { decision: 'approve', note }
      // Unsaved edits of the reviewer are saved first.
      if (decision !== 'reject' && JSON.stringify(form) !== JSON.stringify(fromPost(current!))) {
        if (!(await saveExisting('draft'))) return
      }
      const res = await post<{ notice: string }>(`/posts/${id}/decision`, body)
      setNote('')
      loaded.reload()
      action.setMessage({ tone: 'success', text: NOTICES[res.notice] })
    })
  }

  async function createTerm(kind: 'category' | 'tag') {
    if (!newTerm.trim()) return
    await action.run(async () => {
      const { term } = await post<{ term: { id: string } }>('/terms', { kind, name: newTerm.trim() })
      setNewTerm('')
      refreshTerms()
      set(kind === 'category' ? 'categoryIds' : 'tagIds', [...form[kind === 'category' ? 'categoryIds' : 'tagIds'], term.id])
    })
  }

  const categories = treeOrder(terms.filter((t) => t.kind === 'category'))
  const tags = terms.filter((t) => t.kind === 'tag')
  const reviewer = !!user && canDecidePost(user)

  return (
    <div className="max-w-5xl">
      <PageHeader title={isNew ? 'Új hír' : form.title || 'Hír'}>
        {current && <StatusBadge status={status} rejected={!!current.reviewNote} />}
        <Button onClick={() => action.run(() => openPreview({ kind: 'post', post: form }))}>Előnézet</Button>
      </PageHeader>
      {flash && !action.view && (
        <Notice tone="success" onClose={() => setFlash(null)}>
          {flash}
        </Notice>
      )}
      {action.view}
      {current?.reviewNote && status === 'draft' && (
        <Notice tone="warning">
          <strong>A jóváhagyó üzenete:</strong> {current.reviewNote}
          <br />
          <span className="text-xs">Javítsd a hírt, majd küldd be újra.</span>
        </Notice>
      )}
      {!editable && <Notice>Ezt a hírt most nem szerkesztheted ({status === 'in_review' ? 'jóváhagyásra vár' : 'csak olvasható'}).</Notice>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Label label="Cím">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={!editable} maxLength={300} />
          </Label>
          <Label label="Kivonat" hint="Rövid összefoglaló a listákhoz. Üresen hagyva a szöveg eleje jelenik meg.">
            <Textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} disabled={!editable} maxLength={1000} />
          </Label>
          <div>
            <span className="mb-1 block text-sm font-medium">Szöveg</span>
            {editable ? <RichEditor key={formFor ?? 'new'} value={form.content} onChange={(doc) => set('content', doc)} /> : <p className="text-sm text-petriksoft">A szöveget az előnézetben látod.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Kategóriák">
            <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {categories.map((term) => (
                <label key={term.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={form.categoryIds.includes(term.id)} disabled={!editable} onChange={() => toggle('categoryIds', term.id)} />
                  <span style={{ width: term.depth * 14 }} className="inline-block shrink-0" />
                  {term.name}
                </label>
              ))}
            </div>
            {tags.length > 0 && (
              <>
                <p className="mt-4 mb-1 text-sm font-medium">Címkék</p>
                <div className="flex flex-wrap gap-1.5 text-sm">
                  {tags.map((term) => (
                    <label key={term.id} className="inline-flex items-center gap-1 rounded-full border border-petrikline px-2 py-0.5">
                      <input type="checkbox" checked={form.tagIds.includes(term.id)} disabled={!editable} onChange={() => toggle('tagIds', term.id)} />
                      {term.name}
                    </label>
                  ))}
                </div>
              </>
            )}
            {can('terms.create') && editable && (
              <div className="mt-4 space-y-2">
                <Input placeholder="Új kategória vagy címke" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => createTerm('category')}>+ Kategória</Button>
                  <Button onClick={() => createTerm('tag')}>+ Címke</Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Kiemelt kép">
            {form.featuredImage && <img src={`${form.featuredImage}?w=480&f=webp`} alt="" className="mb-3 w-full rounded-md" />}
            {editable && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setPicking(true)}>{form.featuredImage ? 'Csere' : 'Kép kiválasztása'}</Button>
                {form.featuredImage && <Button onClick={() => set('featuredImage', null)}>Eltávolítás</Button>}
              </div>
            )}
            <label className="mt-3 block text-sm">
              Helye:{' '}
              <select value={form.imagePosition} disabled={!editable} onChange={(e) => set('imagePosition', e.target.value as 'top' | 'bottom')} className="rounded border border-petrikline px-1">
                <option value="top">a szöveg fölött</option>
                <option value="bottom">a szöveg alatt</option>
              </select>
            </label>
          </Card>

          {current && (
            <Card>
              <dl className="space-y-1 text-sm">
                <div><dt className="inline text-petrikfaint">Szerző: </dt><dd className="inline">{names(current.authorId)}</dd></div>
                <div><dt className="inline text-petrikfaint">Módosítva: </dt><dd className="inline">{dateTime(current.updatedAt)}</dd></div>
                {current.publishedAt && <div><dt className="inline text-petrikfaint">Megjelenés: </dt><dd className="inline">{dateTime(current.publishedAt)}</dd></div>}
              </dl>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(isNew || (status === 'draft' && editable)) && (
          <>
            <Button tone="primary" disabled={action.busy} onClick={() => save('submit')}>
              Beküldés jóváhagyásra
            </Button>
            <Button disabled={action.busy} onClick={() => save('draft')}>
              Mentés piszkozatként
            </Button>
          </>
        )}
        {!isNew && editable && status !== 'draft' && (
          <Button tone="primary" disabled={action.busy} onClick={() => save('draft')}>
            Módosítások mentése
          </Button>
        )}
        {current && status === 'scheduled' && reviewer && (
          <Button disabled={action.busy} onClick={() => simple(`/posts/${id}/unschedule`)}>
            Időzítés visszavonása
          </Button>
        )}
        {current && status === 'published' && can('news.manage') && <Button disabled={action.busy} onClick={() => simple(`/posts/${id}/archive`)}>Archiválás</Button>}
        {current && status === 'archived' && can('news.manage') && <Button disabled={action.busy} onClick={() => simple(`/posts/${id}/unarchive`)}>Visszaállítás és újrapublikálás</Button>}
        {current && status === 'trash' && user && canTrashPost(current, user) && (
          <>
            <Button disabled={action.busy} onClick={() => simple(`/posts/${id}/untrash`)}>Visszaállítás piszkozatként</Button>
            <Button tone="danger" disabled={action.busy} onClick={() => window.confirm('Véglegesen törlöd? Ez nem vonható vissza.') && simple(`/posts/${id}`, 'del', () => navigate('/hirek/lomtar'))}>
              Végleges törlés
            </Button>
          </>
        )}
        {current && status !== 'trash' && user && canTrashPost(current, user) && (
          <Button tone="danger" disabled={action.busy} onClick={() => window.confirm('Lomtárba helyezed a hírt?') && simple(`/posts/${id}`, 'del')}>
            Lomtárba
          </Button>
        )}
      </div>

      {current && status === 'scheduled' && reviewer && (
        <Card title="Időzítés" className="mt-6">
          <div className="flex flex-wrap items-end gap-2">
            <Label label="Megjelenés időpontja" hint="A „Módosítások mentése” gomb ezt is elmenti. Legalább egy perccel későbbi időpont legyen.">
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </Label>
          </div>
        </Card>
      )}

      {current && status === 'in_review' && reviewer && (
        <Card title="Döntés" className="mt-6">
          <div className="space-y-3">
            <Label label="Üzenet a szerzőnek" hint="Visszaküldésnél kötelező; jóváhagyásnál a naplóba kerül.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Label>
            <div className="flex flex-wrap items-end gap-2">
              <Button tone="primary" disabled={action.busy} onClick={() => decide('approve')}>
                Jóváhagyás és publikálás most
              </Button>
              <Button tone="danger" disabled={action.busy} onClick={() => decide('reject')}>
                Visszaküldés javításra
              </Button>
              <span className="ml-auto flex items-end gap-2">
                <Label label="Időzítés">
                  <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
                </Label>
                <Button disabled={action.busy || !publishAt} onClick={() => decide('schedule')}>
                  Jóváhagyás időzítve
                </Button>
              </span>
            </div>
          </div>
        </Card>
      )}

      {current && (
        <Card title="Előzmények" className="mt-6">
          <ol className="space-y-2 text-sm">
            {history.data?.entries.map((entry) => (
              <li key={entry.id} className="border-l-2 border-petrikpale pl-3">
                <span className="font-medium">{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</span> · {entry.userName ?? 'rendszer'} · <span className="text-petrikfaint">{dateTime(entry.createdAt)}</span>
                {entry.note && <p className="whitespace-pre-line text-petriksoft">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(url) => {
            set('featuredImage', url)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

/** Categories with their children right under them (depth for indentation). */
function treeOrder<T extends { id: string; parentId: string | null }>(items: T[]): (T & { depth: number })[] {
  const out: (T & { depth: number })[] = []
  const ids = new Set(items.map((i) => i.id))
  const visit = (parent: string | null, depth: number) => {
    for (const item of items.filter((i) => (parent ? i.parentId === parent : !i.parentId || !ids.has(i.parentId)))) {
      out.push({ ...item, depth })
      visit(item.id, depth + 1)
    }
  }
  visit(null, 0)
  return out
}
