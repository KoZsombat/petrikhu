import type { BlockProps } from '@petrik/shared/blocks'
import { getSite } from '@/lib/api'
import { LibraryList } from './LibraryList'
import { Container } from './shared'
import type { BlockContext } from './shared'

/** The document library: categories and documents from the admin, with a live search. */
export async function DocumentLibrary({ eyebrow, title }: BlockProps<'documentLibrary'>, ctx: BlockContext) {
  const { library } = await getSite('hu')
  return (
    <Container className="py-12 md:py-16">
      {eyebrow && <p className="petrik-eyebrow mb-3">{eyebrow}</p>}
      <h1 className="font-display text-4xl font-bold md:text-5xl">{title}</h1>
      <LibraryList
        library={library}
        labels={{
          search: ctx.t('common.searchDocuments'),
          documents: ctx.t('common.documents'),
          categories: ctx.t('common.categories'),
          download: ctx.t('common.download'),
          protected: ctx.t('common.protected'),
          noResults: ctx.t('common.noResults'),
        }}
      />
    </Container>
  )
}
