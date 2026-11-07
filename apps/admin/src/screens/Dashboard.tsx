import { Link } from 'react-router'
import type { PostSummary } from '@petrik/shared/schemas'
import type { PostStatus } from '@petrik/shared/workflow'
import { dateTime } from '@petrik/shared/format'
import { get } from '../api.ts'
import { useUserNames } from '../data.ts'
import { useSession } from '../session.tsx'
import { Card, Empty, Notice, PageHeader, StatusBadge, useLoad } from '../ui.tsx'

type AuthorView = { view: 'author'; counts: Partial<Record<PostStatus, number>>; posts: PostSummary[]; trash: PostSummary[] }
type ReviewerView = {
  view: 'reviewer'
  counts: Partial<Record<PostStatus, number>>
  rejectedCount: number
  publishedToday: number
  queue: PostSummary[]
  own: PostSummary[]
  scheduled: PostSummary[]
  recent: PostSummary[]
  trash: PostSummary[]
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <div className="rounded-xl border border-petriklinesoft bg-petrikcard p-4">
      <p className="font-display text-3xl font-bold text-petrikaccentdark">{value}</p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-petrikfaint">{label}</p>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function PostRows({ posts, empty, date = 'updatedAt' }: { posts: PostSummary[]; empty: string; date?: 'updatedAt' | 'publishedAt' | 'scheduledFor' }) {
  const names = useUserNames()
  if (!posts.length) return <Empty>{empty}</Empty>
  return (
    <ul className="divide-y divide-petriklinesoft">
      {posts.map((post) => (
        <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <Link to={`/hirek/${post.id}`} className="font-medium hover:text-petrikaccentdark hover:underline">
              {post.title}
            </Link>
            <p className="text-xs text-petrikfaint">
              {names(post.authorId)} · {dateTime(post[date] ?? post.updatedAt)}
            </p>
            {post.reviewNote && post.status === 'draft' && <p className="mt-0.5 text-xs text-amber-800">„{post.reviewNote}”</p>}
          </div>
          <StatusBadge status={post.status} rejected={!!post.reviewNote} />
        </li>
      ))}
    </ul>
  )
}

export function Dashboard() {
  const { user, can } = useSession()
  const { data, error } = useLoad(() => (can('news.write') || can('news.review') ? get<AuthorView | ReviewerView>('/posts/dashboard') : Promise.resolve(null)), [])

  return (
    <div className="max-w-6xl">
      <PageHeader title={`Szia, ${user?.displayName}!`} />
      {error && <Notice tone="error">{error}</Notice>}
      {!can('news.write') && !can('news.review') && (
        <Card>
          <p className="text-sm text-petriksoft">
            {can('pages.manage') || can('library.manage') ? 'A bal oldali menüből érheted el az oldalakat, a menüt és a dokumentumtárat.' : 'A fiókodhoz még nem tartozik jogosultság. Kérd meg egy adminisztrátort, hogy állítson be szerepet.'}
          </p>
        </Card>
      )}
      {data?.view === 'author' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Piszkozat" value={data.counts.draft ?? 0} />
            <Stat label="Jóváhagyásra vár" value={data.counts.in_review ?? 0} />
            <Stat label="Időzítve" value={data.counts.scheduled ?? 0} />
            <Stat label="Publikálva" value={data.counts.published ?? 0} />
          </div>
          <Card title="Saját híreim" actions={<Link className="text-sm font-medium text-petrikaccentdark hover:underline" to="/hirek/uj">+ Új hír</Link>}>
            <PostRows posts={data.posts} empty="Még nincs híred." />
          </Card>
          <Card title="Lomtár">
            <PostRows posts={data.trash} empty="A lomtár üres." />
          </Card>
        </div>
      )}
      {data?.view === 'reviewer' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Jóváhagyásra vár" value={data.counts.in_review ?? 0} to="/hirek/jovahagyas" />
            <Stat label="Javításra visszaküldve" value={data.rejectedCount} />
            <Stat label="Időzítve" value={data.counts.scheduled ?? 0} />
            <Stat label="Ma publikálva" value={data.publishedToday} />
          </div>
          <Card title="Jóváhagyásra vár">
            <PostRows posts={data.queue} empty="Nincs jóváhagyásra váró hír." />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Saját piszkozataim" actions={<Link className="text-sm font-medium text-petrikaccentdark hover:underline" to="/hirek/uj">+ Új hír</Link>}>
              <PostRows posts={data.own} empty="Nincs piszkozatod." />
            </Card>
            <Card title="Időzített hírek">
              <PostRows posts={data.scheduled} empty="Nincs időzített hír." date="scheduledFor" />
            </Card>
            <Card title="Legutóbb módosított kint lévő hírek">
              <PostRows posts={data.recent} empty="Még nincs publikált hír." date="publishedAt" />
            </Card>
            <Card title="Lomtár">
              <PostRows posts={data.trash} empty="A lomtár üres." />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
