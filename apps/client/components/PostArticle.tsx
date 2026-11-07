import { longDate } from '@petrik/shared/format'
import { isEmptyDoc } from '@petrik/shared/tiptap'
import type { PublicPost } from '@petrik/shared/schemas'
import type { Locale, T } from '@/lib/i18n'
import { Picture } from './Picture'
import { RichContent } from './RichContent'

/** A news article: the public /hirek/<slug> page and the admin's preview. */
export function PostArticle({ post, t, locale }: { post: PublicPost; t: T; locale: Locale }) {
  const picture = post.featuredImage && <Picture src={post.featuredImage} alt="" sizes="(min-width: 860px) 740px, 100vw" className="h-auto w-full rounded-lg" />
  return (
    <article className="mx-auto w-full max-w-[820px] px-5 py-12 sm:px-10 md:py-16" data-component="post">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark">{t('common.news')}</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-petrikink md:text-5xl">{post.title}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.15em] text-petrikfaint">
        <time dateTime={post.publishedAt}>{longDate(post.publishedAt, locale)}</time>
        {post.categories.map((category) => (
          <span key={category} className="rounded-full bg-petriktint px-2.5 py-0.5 text-petrikaccentdark">
            {category}
          </span>
        ))}
      </p>
      {picture && post.imagePosition === 'top' && <div className="mt-8">{picture}</div>}
      <div className="mt-8">{isEmptyDoc(post.content) ? <p className="text-petriksoft">{t('common.noContent')}</p> : <RichContent doc={post.content} variant="post" embedTitle={t('common.embedded')} playLabel={(name) => t('common.playVideo', { title: name })} />}</div>
      {picture && post.imagePosition === 'bottom' && <div className="mt-8">{picture}</div>}
    </article>
  )
}
