import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@/components/blocks/PageRenderer'
import { PostArticle } from '@/components/PostArticle'
import { getPreview } from '@/lib/api'
import { t as translatorFor } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Előnézet', robots: { index: false, follow: false } }

/** A preview the admin made through the API (/api/preview): only its author can open it. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const preview = await getPreview((await params).id)
  if (!preview) notFound()
  const locale = preview.kind === 'page' ? preview.page.locale : 'hu'
  const t = translatorFor(locale)
  return (
    <>
      <p role="note" className="bg-petriklight/40 px-4 py-2 text-center font-mono text-xs uppercase tracking-[0.15em] text-petrikink">
        {t('common.preview')}
      </p>
      {preview.kind === 'page' ? (
        <PageRenderer blocks={preview.page.blocks} ctx={{ locale, t, path: `/elonezet/${(await params).id}`, searchParams: await searchParams }} />
      ) : (
        <PostArticle post={preview.post} t={t} locale="hu" />
      )}
    </>
  )
}
