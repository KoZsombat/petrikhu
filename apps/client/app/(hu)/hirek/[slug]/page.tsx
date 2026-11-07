import { notFound } from 'next/navigation'
import { PostArticle } from '@/components/PostArticle'
import { getPost } from '@/lib/api'
import { t } from '@/lib/i18n'
import { postMetadata } from '@/lib/meta'
import { JsonLd } from '@/components/JsonLd'
import { articleData } from '@/lib/structured'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const slug = decodeURIComponent((await params).slug)
  const post = await getPost(slug)
  return post ? postMetadata(post, `/hirek/${slug}`) : { title: t('hu')('common.notFound'), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const post = await getPost(decodeURIComponent((await params).slug))
  if (!post) notFound()
  return (
    <>
      <JsonLd data={articleData(post, `/hirek/${post.slug}`)} />
      <PostArticle post={post} t={t('hu')} locale="hu" />
    </>
  )
}
