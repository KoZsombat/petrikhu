import { useState } from 'react'
import type { PostSummary } from '@petrik/shared/schemas'
import type { PostStatus } from '@petrik/shared/workflow'
import { get, post as post_ } from '../api.ts'
import { Button, Card, Input, Notice, PageHeader, Pager, useAction, useLoad } from '../ui.tsx'
import { useDialog } from '../dialog.tsx'
import { PostRows } from './Dashboard.tsx'

const TITLES: Partial<Record<PostStatus, string>> = { in_review: 'Jóváhagyásra vár', scheduled: 'Időzített hírek', published: 'Publikált hírek', archived: 'Archívum', trash: 'Lomtár' }

/** One status of posts, newest first, searchable (title and text), 30 per page. */
export function PostList({ status }: { status: PostStatus }) {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const action = useAction()
  const dialog = useDialog()
  const { data, error, reload } = useLoad(() => get<{ posts: PostSummary[]; total: number; totalPages: number }>(`/posts?status=${status}&page=${page}&q=${encodeURIComponent(query)}`), [status, page, query])
  return (
    <div className="max-w-5xl">
      <PageHeader title={TITLES[status] ?? status} />
      {error && <Notice tone="error">{error}</Notice>}
      {action.view}
      <Card>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setQuery(q)
          }}
        >
          <Input type="search" placeholder="Keresés címben és szövegben…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Keresés" />
        </form>
        {data && <p className="mb-2 text-xs text-petrikfaint">{data.total} hír</p>}
        <PostRows
          posts={data?.posts ?? []}
          empty="Nincs ilyen hír."
          date={status === 'published' || status === 'archived' ? 'publishedAt' : status === 'scheduled' ? 'scheduledFor' : 'updatedAt'}
          actions={
            status === 'scheduled'
              ? (post) => (
                  <Button disabled={action.busy} onClick={async () => (await dialog.confirm({ title: 'Időzítés visszavonása', message: `„${post.title}” nem jelenik meg az időzített időpontban; újra jóváhagyásra vár.`, confirmLabel: 'Visszavonás' })) && action.run(async () => (await post_(`/posts/${post.id}/unschedule`), reload()), `„${post.title}”: időzítés visszavonva, újra jóváhagyásra vár.`)}>
                    Időzítés visszavonása
                  </Button>
                )
              : undefined
          }
        />
        <Pager page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
      </Card>
    </div>
  )
}
