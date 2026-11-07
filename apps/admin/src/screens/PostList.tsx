import { useState } from 'react'
import type { PostSummary } from '@petrik/shared/schemas'
import type { PostStatus } from '@petrik/shared/workflow'
import { get } from '../api.ts'
import { Card, Input, Notice, PageHeader, Pager, useLoad } from '../ui.tsx'
import { PostRows } from './Dashboard.tsx'

const TITLES: Partial<Record<PostStatus, string>> = { in_review: 'Jóváhagyásra vár', published: 'Publikált hírek', archived: 'Archívum', trash: 'Lomtár' }

/** One status of posts, newest first, searchable (title and text), 30 per page. */
export function PostList({ status }: { status: PostStatus }) {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, error } = useLoad(() => get<{ posts: PostSummary[]; total: number; totalPages: number }>(`/posts?status=${status}&page=${page}&q=${encodeURIComponent(query)}`), [status, page, query])
  return (
    <div className="max-w-5xl">
      <PageHeader title={TITLES[status] ?? status} />
      {error && <Notice tone="error">{error}</Notice>}
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
        <PostRows posts={data?.posts ?? []} empty="Nincs ilyen hír." date={status === 'published' || status === 'archived' ? 'publishedAt' : 'updatedAt'} />
        <Pager page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
      </Card>
    </div>
  )
}
