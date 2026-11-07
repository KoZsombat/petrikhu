import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Block } from '@petrik/shared/blocks'
import { Cards } from './Cards'
import { DocumentLibrary } from './DocumentLibrary'
import { NewsList } from './NewsList'
import { PageTitle } from './PageTitle'
import { Rows } from './Rows'
import { Accordion, Callout, CheckList, Cta, Feature, Gallery, LinkList, LogoGrid, RichTextBlock, Table, Video } from './Simple'
import type { BlockContext } from './shared'

/** Block type → renderer. Every type of packages/shared/src/blocks.ts must be here (the type checker enforces it). */
const RENDERERS: { [K in Block['type']]: (props: Extract<Block, { type: K }>['props'], ctx: BlockContext) => ReactNode | Promise<ReactNode> } = {
  pageTitle: PageTitle,
  richText: RichTextBlock,
  feature: Feature,
  callout: Callout,
  cards: Cards,
  rows: Rows,
  checkList: CheckList,
  linkList: LinkList,
  logoGrid: LogoGrid,
  gallery: Gallery,
  table: Table,
  video: Video,
  accordion: Accordion,
  cta: Cta,
  newsList: NewsList,
  documentLibrary: DocumentLibrary,
}

async function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const render = RENDERERS[block.type] as ((props: unknown, ctx: BlockContext) => ReactNode | Promise<ReactNode>) | undefined
  return render ? await render(block.props, ctx) : null
}

/** A page's blocks in order; an unknown type (data from a newer schema) is skipped. */
export function PageRenderer({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  return (
    <>
      {blocks.map((block) => (
        <Fragment key={block.id}>
          <BlockView block={block} ctx={ctx} />
        </Fragment>
      ))}
    </>
  )
}
