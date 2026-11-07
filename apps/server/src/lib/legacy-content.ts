/**
 * The previous app's content formats → the current ones. Used by the seed (pages.json) and the legacy
 * migration (old database).
 *
 * - Posts: the "blocks and runs" document ([{ type: 'paragraph', runs: [{ text, bold, href, color }] }, …,
 *   table / image / gallery / embed]) → TipTap JSON.
 * - Pages: `{ component, variant, values }` blocks with sanitized-HTML fields → `{ id, type, props }` blocks.
 */
import { BLOCK_SCHEMAS, blockId } from '@petrik/shared/blocks'
import type { Block, BlockType } from '@petrik/shared/blocks'
import { isEmbedSrc, isImageSrc, isSafeColor, isSafeHref } from '@petrik/shared/links'
import type { Mark, RichDoc, RichNode, TextAlign } from '@petrik/shared/tiptap'
import { htmlToTiptap, textToTiptap } from './html-to-tiptap.ts'

/* --- posts: blocks and runs → TipTap ------------------------------------------------------------- */

type Run = { text?: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; href?: string; style?: Record<string, string> }
type LegacyBlock = {
  type?: string
  align?: string
  level?: number
  runs?: Run[]
  table?: { header?: boolean; rows?: string[][] }
  image?: { src?: string; alt?: string; caption?: string; href?: string; width?: number; height?: number }
  gallery?: { src?: string; alt?: string; full?: string }[]
  embed?: { src?: string; title?: string; aspect?: number; height?: number }
}

function runsToInline(runs: Run[] | undefined): RichNode[] {
  const out: RichNode[] = []
  for (const run of runs ?? []) {
    const marks: Mark[] = []
    if (run.bold || run.style?.fontWeight === 'bold' || /^[6-9]00$/.test(run.style?.fontWeight ?? '')) marks.push({ type: 'bold' })
    if (run.italic) marks.push({ type: 'italic' })
    if (run.underline) marks.push({ type: 'underline' })
    const color = run.color ?? run.style?.color
    if (color && isSafeColor(color)) marks.push({ type: 'textStyle', attrs: { color } })
    if (run.href && isSafeHref(run.href)) marks.push({ type: 'link', attrs: { href: run.href } })
    const lines = String(run.text ?? '').split('\n')
    lines.forEach((line, i) => {
      if (i > 0) out.push({ type: 'hardBreak' })
      if (line) out.push(marks.length ? { type: 'text', text: line, marks } : { type: 'text', text: line })
    })
  }
  return out
}

const alignOf = (value: string | undefined): TextAlign | null => (value === 'center' || value === 'right' || value === 'justify' ? value : null)

function cellParagraph(text: string): RichNode[] {
  return [{ type: 'paragraph', content: text ? runsToInline([{ text }]) : undefined }]
}

export function runsToTiptap(value: unknown): RichDoc {
  const blocks = Array.isArray(value) ? (value as LegacyBlock[]) : []
  const content: RichNode[] = []
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const inline = runsToInline(block.runs)
    const align = alignOf(block.align)
    switch (block.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, block.level ?? 2)) as 1 | 2 | 3 | 4 | 5 | 6
        content.push({ type: 'heading', attrs: { level, textAlign: align }, content: inline })
        break
      }
      case 'bulleted-list':
      case 'numbered-list': {
        const items: RichNode[] = []
        while (i < blocks.length && blocks[i].type === block.type) {
          items.push({ type: 'listItem', content: [{ type: 'paragraph', content: runsToInline(blocks[i].runs) }] })
          i += 1
        }
        i -= 1
        content.push({ type: block.type === 'bulleted-list' ? 'bulletList' : 'orderedList', content: items })
        break
      }
      case 'blockquote':
        content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inline }] })
        break
      case 'table': {
        const rows = block.table?.rows ?? []
        if (!rows.length) break
        content.push({
          type: 'table',
          content: rows.map((row, r) => ({
            type: 'tableRow' as const,
            content: row.map((cell) => ({ type: (r === 0 && block.table?.header ? 'tableHeader' : 'tableCell') as 'tableCell', content: cellParagraph(cell) })),
          })),
        })
        break
      }
      case 'image': {
        const image = block.image
        if (image?.src && isImageSrc(image.src)) {
          content.push({
            type: 'image',
            attrs: {
              src: image.src,
              alt: image.alt ?? '',
              caption: image.caption ?? null,
              href: image.href && isSafeHref(image.href) ? image.href : null,
              width: image.width ?? null,
              height: image.height ?? null,
              textAlign: align,
            },
          })
        }
        break
      }
      case 'gallery': {
        const items = (block.gallery ?? [])
          .filter((item) => item.src && isImageSrc(item.src))
          .map((item) => ({ src: item.src!, alt: item.alt ?? '', full: item.full && isImageSrc(item.full) ? item.full : null }))
        if (items.length) content.push({ type: 'gallery', attrs: { items } })
        break
      }
      case 'embed':
        if (block.embed?.src && isEmbedSrc(block.embed.src)) {
          content.push({ type: 'embed', attrs: { src: block.embed.src, title: block.embed.title ?? null, aspect: block.embed.aspect ?? null, height: block.embed.height ?? null } })
        }
        break
      default:
        // paragraph, div, plain
        content.push({ type: 'paragraph', ...(align ? { attrs: { textAlign: align } } : {}), content: inline.length ? inline : undefined })
    }
  }
  for (const node of content) if ('content' in node && node.content?.length === 0) delete node.content
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/* --- pages: old component blocks → new blocks ------------------------------------------------------------ */

type OldBlock = { component?: string; variant?: string; values?: Record<string, unknown> }

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const html = (value: unknown) => htmlToTiptap(typeof value === 'string' ? value : '')

/** Drops empty strings (the old form saved them for untouched fields) and undefined values. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T
  if (value && typeof value === 'object' && !('type' in value && (value as { type: unknown }).type === 'doc')) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== '' && v !== undefined && v !== null).map(([k, v]) => [k, clean(v)])) as T
  }
  return value
}

/** `/hirek?kategoria=Esti munkarend` → `Esti munkarend`; `/hirek` → undefined. */
function categoryOfHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined
  try {
    return new URL(href, 'http://x').searchParams.get('kategoria') ?? undefined
  } catch {
    return undefined
  }
}

function convertBlock(old: OldBlock): { type: BlockType; props: Record<string, unknown> } | null {
  const v = old.values ?? {}
  switch (old.component) {
    case 'PageTitle':
      return { type: 'pageTitle', props: { breadcrumb: v.breadcrumb, title: v.title, intro: v.intro, cover: v.cover } }
    case 'RichText':
      return { type: 'richText', props: { content: html(v.html) } }
    case 'Feature':
      return { type: 'feature', props: { ...v, html: undefined, content: v.html ? html(v.html) : undefined } }
    case 'Callout':
      return { type: 'callout', props: { title: v.title, tone: v.tone ?? 'info', content: html(v.html) } }
    case 'Accordion':
      return { type: 'accordion', props: { heading: v.heading, openFirst: v.openFirst === true, items: ((v.items as { title: string; html: string }[]) ?? []).map((item) => ({ title: item.title, content: html(item.html) })) } }
    case 'CardGrid':
      if (old.variant === 'highlight') return { type: 'callout', props: { title: v.title, tone: 'highlight', content: textToTiptap(str(v.text) ?? '') } }
      if (old.variant === 'news') return { type: 'newsList', props: { items: ((v.items as Record<string, unknown>[]) ?? []).map((item) => ({ ...item })), limit: v.limit } }
      return { type: 'cards', props: { ...v, variant: old.variant ?? 'text' } }
    case 'RowList':
      if (old.variant === 'news') {
        return {
          type: 'newsList',
          props: {
            limit: v.limit,
            items: v.rows,
            filters: ((v.filters as { label: string; href: string }[] | undefined) ?? []).map((f) => ({ label: f.label, category: categoryOfHref(f.href) })),
            paginate: Boolean(v.pagination),
          },
        }
      }
      return { type: 'rows', props: { ...v, variant: old.variant ?? 'fact' } }
    case 'CheckList':
      return { type: 'checkList', props: v }
    case 'LinkList':
      return { type: 'linkList', props: v }
    case 'LogoGrid':
      return { type: 'logoGrid', props: v }
    case 'Gallery':
      return { type: 'gallery', props: v }
    case 'DataTable':
      return { type: 'table', props: v }
    case 'VideoEmbed':
      return { type: 'video', props: v }
    case 'CtaBand':
      return { type: 'cta', props: v }
    default:
      return null
  }
}

export type ConvertIssue = { index: number; component: string; message: string }

/**
 * Converts and validates an old page. Blocks that cannot be converted are reported (and left out) rather than
 * failing the whole page.
 */
export function convertPageBlocks(old: unknown): { blocks: Block[]; issues: ConvertIssue[] } {
  const blocks: Block[] = []
  const issues: ConvertIssue[] = []
  ;(Array.isArray(old) ? (old as OldBlock[]) : []).forEach((item, index) => {
    const converted = convertBlock(item)
    if (!converted) {
      issues.push({ index, component: String(item.component), message: 'unknown component' })
      return
    }
    const props = clean(converted.props)
    const parsed = BLOCK_SCHEMAS[converted.type].safeParse(props)
    if (!parsed.success) {
      issues.push({ index, component: String(item.component), message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
      return
    }
    blocks.push({ id: blockId(), type: converted.type, props: parsed.data } as Block)
  })
  return { blocks, issues }
}
