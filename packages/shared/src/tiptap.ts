/**
 * TipTap (ProseMirror) JSON: the only rich-text format. This file is the data side, shared by the server
 * (validation), the public site (renders it to JSX) and the admin (the editor's extensions live in
 * tiptap-extensions.ts and produce exactly these nodes).
 */
import { z } from 'zod'
import { isEmbedSrc, isImageSrc, isSafeColor, isSafeHref } from './links.ts'

export type Mark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
  | { type: 'link'; attrs: { href: string } }
  | { type: 'textStyle'; attrs: { color?: string | null } }

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type GalleryItem = { src: string; alt: string; full?: string | null }

export type RichNode =
  | { type: 'text'; text: string; marks?: Mark[] }
  | { type: 'hardBreak' }
  | { type: 'horizontalRule' }
  | { type: 'paragraph'; attrs?: { textAlign?: TextAlign | null }; content?: RichNode[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3 | 4 | 5 | 6; textAlign?: TextAlign | null }; content?: RichNode[] }
  | { type: 'bulletList' | 'listItem' | 'blockquote' | 'table' | 'tableRow'; content?: RichNode[] }
  | { type: 'orderedList'; attrs?: { start?: number | null }; content?: RichNode[] }
  | { type: 'tableHeader' | 'tableCell'; attrs?: { colspan?: number | null; rowspan?: number | null }; content?: RichNode[] }
  | {
      type: 'image'
      attrs: { src: string; alt?: string | null; title?: string | null; width?: number | null; height?: number | null; href?: string | null; caption?: string | null; textAlign?: TextAlign | null }
    }
  | { type: 'gallery'; attrs: { items: GalleryItem[] } }
  | { type: 'embed'; attrs: { src: string; title?: string | null; aspect?: number | null; height?: number | null } }

export type RichDoc = { type: 'doc'; content: RichNode[] }

const MAX_DEPTH = 24
const MAX_NODES = 20000

const align = z.enum(['left', 'center', 'right', 'justify']).nullish()
const text = (max: number) => z.string().max(max)
const optionalText = (max: number) => z.string().max(max).nullish()

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['bold', 'italic', 'underline', 'strike', 'code']) }),
  z.object({ type: z.literal('link'), attrs: z.object({ href: text(2000).refine(isSafeHref, 'unsafe_link') }) }),
  z.object({ type: z.literal('textStyle'), attrs: z.object({ color: z.string().max(40).refine(isSafeColor, 'unsafe_color').nullish() }) }),
])

const children = z.lazy(() => z.array(nodeSchema).max(5000).optional())

const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: text(100000), marks: z.array(markSchema).max(10).optional() }),
    z.object({ type: z.enum(['hardBreak', 'horizontalRule']) }),
    z.object({ type: z.literal('paragraph'), attrs: z.object({ textAlign: align }).optional(), content: children }),
    z.object({ type: z.literal('heading'), attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]), textAlign: align }), content: children }),
    z.object({ type: z.enum(['bulletList', 'listItem', 'blockquote', 'table', 'tableRow']), content: children }),
    z.object({ type: z.literal('orderedList'), attrs: z.object({ start: z.number().int().min(0).max(100000).nullish() }).optional(), content: children }),
    z.object({
      type: z.enum(['tableHeader', 'tableCell']),
      attrs: z.object({ colspan: z.number().int().min(1).max(50).nullish(), rowspan: z.number().int().min(1).max(500).nullish() }).optional(),
      content: children,
    }),
    z.object({
      type: z.literal('image'),
      attrs: z.object({
        src: text(2000).refine(isImageSrc, 'unsafe_src'),
        alt: optionalText(500),
        title: optionalText(500),
        width: z.number().int().positive().max(20000).nullish(),
        height: z.number().int().positive().max(20000).nullish(),
        href: z.string().max(2000).refine(isSafeHref, 'unsafe_link').nullish(),
        caption: optionalText(1000),
        textAlign: align,
      }),
    }),
    z.object({
      type: z.literal('gallery'),
      attrs: z.object({
        items: z.array(z.object({ src: text(2000).refine(isImageSrc, 'unsafe_src'), alt: text(500), full: z.string().max(2000).refine(isImageSrc, 'unsafe_src').nullish() })).max(200),
      }),
    }),
    z.object({
      type: z.literal('embed'),
      attrs: z.object({
        src: text(2000).refine(isEmbedSrc, 'unsafe_embed'),
        title: optionalText(300),
        aspect: z.number().positive().max(10).nullish(),
        height: z.number().int().positive().max(5000).nullish(),
      }),
    }),
  ]),
) as z.ZodType<RichNode>

/** Rejects absurdly deep or large trees before zod recurses into them. */
function withinLimits(value: unknown): boolean {
  let nodes = 0
  const stack: [unknown, number][] = [[value, 0]]
  while (stack.length) {
    const [node, depth] = stack.pop()!
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) return false
    const content = (node as { content?: unknown } | null)?.content
    if (Array.isArray(content)) for (const child of content) stack.push([child, depth + 1])
  }
  return true
}

export const richDocSchema = z.preprocess(
  (value) => (withinLimits(value) ? value : { type: 'invalid' }),
  z.object({ type: z.literal('doc'), content: z.array(nodeSchema).max(5000) }),
) as unknown as z.ZodType<RichDoc>

export function emptyDoc(): RichDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function paragraphDoc(...paragraphs: string[]): RichDoc {
  return {
    type: 'doc',
    content: paragraphs.map((value) => (value ? { type: 'paragraph', content: [{ type: 'text', text: value }] } : { type: 'paragraph' })),
  }
}

const BLOCK_NODES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'tableCell', 'tableHeader', 'tableRow'])

/** Plain text of a document (search, excerpts, meta descriptions). */
export function plainText(doc: RichDoc | null | undefined): string {
  let out = ''
  const visit = (nodes: RichNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'text') out += node.text
      else if (node.type === 'hardBreak') out += ' '
      else if (node.type === 'image') out += node.attrs.caption ? ` ${node.attrs.caption} ` : ''
      else if ('content' in node) {
        visit(node.content)
        if (BLOCK_NODES.has(node.type)) out += '\n'
      }
    }
  }
  visit(doc?.content)
  return out.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim()
}

/** No text and no media: a picture, a gallery or an embed counts as content. */
export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  if (plainText(doc).trim() !== '') return false
  let media = false
  const visit = (nodes: RichNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'image' || node.type === 'gallery' || node.type === 'embed') media = true
      else if ('content' in node) visit(node.content)
    }
  }
  visit(doc?.content)
  return !media
}

/** The first picture of a document (card thumbnail when a post has no featured image). */
export function firstImage(doc: RichDoc | null | undefined): string | undefined {
  const visit = (nodes: RichNode[] | undefined): string | undefined => {
    for (const node of nodes ?? []) {
      if (node.type === 'image') return node.attrs.src
      if (node.type === 'gallery' && node.attrs.items[0]) return node.attrs.items[0].src
      if ('content' in node) {
        const found = visit(node.content)
        if (found) return found
      }
    }
    return undefined
  }
  return visit(doc?.content)
}
