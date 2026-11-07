import type { Metadata } from 'next'
import { Container } from '@/components/blocks/shared'
import { NewsRows, toRow } from '@/components/blocks/NewsList'
import { ApiStatusError, getPosts } from '@/lib/api'
import { t as translatorFor } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Keresés', robots: { index: false } }

/** /kereses?q=…: searches the published news (title and text, accent-insensitive). A plain GET form, no JavaScript. */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const t = translatorFor('hu')
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? ''
  let result = { posts: [] as Awaited<ReturnType<typeof getPosts>>['posts'], total: 0 }
  let tooMany = false
  if (q) {
    try {
      result = await getPosts({ q, limit: 50 })
    } catch (error) {
      if (!(error instanceof ApiStatusError && error.status === 429)) throw error
      tooMany = true
    }
  }
  const { posts, total } = result
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <h1 className="font-display text-3xl font-bold">{t('common.search')}</h1>
        <form action="/kereses" method="get" role="search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            aria-label={t('common.search')}
            placeholder={t('common.searchNews')}
            className="mt-4 block w-full rounded-md border border-petrikline bg-petrikcard px-3 py-2 text-sm focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25"
          />
        </form>
        {q && !tooMany && (
          <p className="mt-3 text-sm text-petriksoft">
            {total} {t('common.results')}
          </p>
        )}
        {tooMany && (
          <p role="status" className="mt-3 text-sm text-petriksoft">
            {t('common.searchTooMany')}
          </p>
        )}
      </div>
      {posts.length > 0 && (
        <section data-component="newsList" className="py-14 md:py-16">
          <Container>
            <NewsRows rows={posts.map((post) => toRow(post, 'hu'))} t={t} />
          </Container>
        </section>
      )}
    </>
  )
}
