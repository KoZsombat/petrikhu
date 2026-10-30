/**
 * The Szerkesztő's content model for text (AGENT.md 6.20): a small, faithful
 * HTML tree.
 *
 * Why a tree and not the Hírkezelő's blocks-and-runs: a mirrored page must
 * render byte-for-byte as it did before it became a document, and the mirror
 * nests things in orders a flat run cannot express (`<strong><a>…</a></strong>`
 * next to `<a><strong>…</strong></a>`), puts two identical `<a>` side by side,
 * and keeps empty ones. So the stored form is the tree itself, element for
 * element; the editor works on a flattened view of it (`richToBlocks` /
 * `blocksToRich`) and only re-nests the blocks a person actually edits.
 *
 * Pure data, no React: the client renderer, the editor, the server's
 * validation and the generation scripts all share it. Plain `.ts` for
 * `node --experimental-strip-types`.
 */
import type { RichStyle, RichStyleKey, RichTextBlock, RichTextDocument, TextRun } from './types.ts'
import { RICH_STYLE_KEYS } from './types.ts'
import { isSafeColor } from './richtext.ts'

export type RichTag =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'blockquote'
  | 'div'
  | 'ul'
  | 'ol'
  | 'li'
  | 'strong'
  | 'em'
  | 'u'
  | 'span'
  | 'a'
  | 'br'

export const RICH_TAGS: readonly RichTag[] = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'div',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'u',
  'span',
  'a',
  'br',
]

/**
 * `href` only on `a`. The renderer decides how the link is made, from the
 * target alone, the way the generator always did: an http(s) URL opens in a
 * new tab, a file under /media/ or a mailto:/tel: is a plain anchor, any other
 * root-relative path is a router link.
 */
export type RichElement = { tag: RichTag; style?: RichStyle; href?: string; children?: RichNode[] }

/** A string is a text node - the whitespace the generator writes as `{' '}` included. */
export type RichNode = string | RichElement

export type RichContent = RichNode[]

const BLOCK_TAGS: ReadonlySet<string> = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div'])
const LIST_TAGS: ReadonlySet<string> = new Set(['ul', 'ol'])
const INLINE_TAGS: ReadonlySet<string> = new Set(['strong', 'em', 'u', 'span', 'a', 'br'])

export function isRichElement(node: RichNode): node is RichElement {
  return typeof node !== 'string'
}

export function el(tag: RichTag, children?: RichNode[], extra: { style?: RichStyle; href?: string } = {}): RichElement {
  const node: RichElement = { tag }
  if (extra.style && Object.keys(extra.style).length) node.style = extra.style
  if (extra.href) node.href = extra.href
  if (children && children.length) node.children = children
  return node
}

/** Plain text of a content tree, for summaries and search. `<br>` and block ends count as a space. */
export function richPlainText(nodes: RichNode[]): string {
  let out = ''
  const visit = (list: RichNode[]) => {
    for (const node of list) {
      if (typeof node === 'string') {
        out += node
        continue
      }
      if (node.tag === 'br') {
        out += ' '
        continue
      }
      if (node.children) visit(node.children)
      if (BLOCK_TAGS.has(node.tag) || node.tag === 'li') out += ' '
    }
  }
  visit(nodes)
  return out.replace(/\s+/g, ' ').trim()
}

/* -------------------------------------------------------------------------
 * Legacy: the blocks-and-runs content the v1 builder pages stored. Converted
 * with the same markup the v1 renderer produced (RichText.tsx), so an old
 * page keeps its look.
 * ----------------------------------------------------------------------- */

export function isLegacyBlocks(value: unknown): value is RichTextDocument {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'runs' in value[0] &&
    'type' in value[0]
  )
}

export function isFileHref(href: string): boolean {
  return href.startsWith('//') || href.startsWith('/media/') || href.startsWith('/uploads/') || href.startsWith('mailto:') || href.startsWith('tel:')
}

/** One run as nodes: text with `\n` as `<br>`, wrapped span → u → em → strong → a (innermost first). */
export function runToNodes(run: TextRun): RichNode[] {
  const parts = run.text.split('\n')
  let nodes: RichNode[] = []
  parts.forEach((part, index) => {
    if (index > 0) nodes.push(el('br'))
    if (part) nodes.push(part)
  })
  const style: RichStyle = { ...run.style }
  if (run.color) style.color = run.color
  if (Object.keys(style).length) nodes = [el('span', nodes, { style })]
  if (run.underline) nodes = [el('u', nodes)]
  if (run.italic) nodes = [el('em', nodes)]
  if (run.bold) nodes = [el('strong', nodes)]
  if (run.href) nodes = [el('a', nodes, { href: run.href })]
  return nodes
}

function blockStyle(block: RichTextBlock): RichStyle | undefined {
  const style: RichStyle = { ...block.style }
  if (block.align) style.textAlign = block.align
  return Object.keys(style).length ? style : undefined
}

/**
 * The blocks-and-runs model as content nodes. Used for the v1 stored
 * documents (on load) and by the editor, whose blocks it turns back into the
 * stored tree after an edit.
 */
export function blocksToRich(blocks: RichTextDocument): RichContent {
  const out: RichContent = []
  let index = 0

  const pushSeparator = () => {
    if (out.length) out.push(' ')
  }

  /** The list starting at blocks[start]: every following block at this depth or deeper belongs to it. */
  const buildList = (start: number, depth: number): { node: RichElement; next: number } => {
    const tag: RichTag = blocks[start].type === 'numbered-list' ? 'ol' : 'ul'
    const items: RichNode[] = []
    let at = start
    while (at < blocks.length) {
      const block = blocks[at]
      const isList = block.type === 'bulleted-list' || block.type === 'numbered-list'
      const blockDepth = block.depth ?? 0
      if (!isList || blockDepth < depth) break
      if (blockDepth > depth) {
        // A deeper item with no parent at this level: nest it in an item of its own.
        const nested = buildList(at, blockDepth)
        items.push(el('li', [nested.node]))
        at = nested.next
        continue
      }
      if (block.type !== blocks[start].type) break
      const children: RichNode[] = blockRuns(block)
      at += 1
      // Deeper items that follow are this item's sub-list.
      if (at < blocks.length && isListBlock(blocks[at]) && (blocks[at].depth ?? 0) > depth) {
        const nested = buildList(at, depth + 1)
        children.push(nested.node)
        at = nested.next
      }
      items.push(el('li', children))
    }
    return { node: el(tag, items), next: at }
  }

  while (index < blocks.length) {
    const block = blocks[index]
    pushSeparator()
    if (isListBlock(block)) {
      const list = buildList(index, block.depth ?? 0)
      out.push(list.node)
      index = list.next
      continue
    }
    index += 1
    if (block.type === 'plain') {
      // Inline content with no element around it - no separator before it either.
      if (out[out.length - 1] === ' ') out.pop()
      out.push(...blockRuns(block))
      continue
    }
    const style = blockStyle(block)
    const children = blockRuns(block)
    if (block.type === 'heading') {
      out.push(el(`h${block.level ?? 2}` as RichTag, children, { style }))
    } else if (block.type === 'blockquote') {
      out.push(el('blockquote', children, { style }))
    } else if (block.type === 'div') {
      out.push(el('div', children, { style }))
    } else {
      out.push(el('p', children, { style }))
    }
  }
  return out
}

function isListBlock(block: RichTextBlock): boolean {
  return block.type === 'bulleted-list' || block.type === 'numbered-list'
}

function blockRuns(block: RichTextBlock): RichNode[] {
  return block.runs.flatMap(runToNodes)
}

/**
 * Anything a stored `content` field may hold - a content tree, or the blocks
 * an old (v1) builder page saved - as a content tree.
 */
export function toRichContent(value: unknown): RichContent {
  if (!Array.isArray(value)) return []
  if (isLegacyBlocks(value)) return blocksToRich(value)
  return value as RichContent
}

/* -------------------------------------------------------------------------
 * The editor's view: the tree flattened to blocks and runs.
 * ----------------------------------------------------------------------- */

type Marks = { bold?: boolean; italic?: boolean; underline?: boolean; href?: string; style?: RichStyle }

let counter = 0
function blockId(): string {
  counter += 1
  return `rb${Date.now().toString(36)}${counter.toString(36)}`
}

function sameMarks(a: TextRun, b: TextRun): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    a.href === b.href &&
    JSON.stringify(a.style ?? {}) === JSON.stringify(b.style ?? {})
  )
}

function pushRun(runs: TextRun[], text: string, marks: Marks): void {
  if (!text) return
  const run: TextRun = { text }
  if (marks.bold) run.bold = true
  if (marks.italic) run.italic = true
  if (marks.underline) run.underline = true
  if (marks.href) run.href = marks.href
  if (marks.style && Object.keys(marks.style).length) run.style = marks.style
  const last = runs[runs.length - 1]
  if (last && sameMarks(last, run)) last.text += text
  else runs.push(run)
}

function inlineRuns(nodes: RichNode[], marks: Marks, runs: TextRun[]): void {
  for (const node of nodes) {
    if (typeof node === 'string') {
      pushRun(runs, node, marks)
      continue
    }
    switch (node.tag) {
      case 'br':
        pushRun(runs, '\n', marks)
        break
      case 'strong':
        inlineRuns(node.children ?? [], { ...marks, bold: true }, runs)
        break
      case 'em':
        inlineRuns(node.children ?? [], { ...marks, italic: true }, runs)
        break
      case 'u':
        inlineRuns(node.children ?? [], { ...marks, underline: true }, runs)
        break
      case 'a':
        inlineRuns(node.children ?? [], { ...marks, href: node.href ?? marks.href }, runs)
        break
      case 'span':
        inlineRuns(node.children ?? [], { ...marks, style: { ...marks.style, ...node.style } }, runs)
        break
      default:
        // A block inside inline content is flattened to its text; blocks that
        // sit directly in a block list are handled by richToBlocks.
        inlineRuns(node.children ?? [], marks, runs)
    }
  }
}

function alignOf(style: RichStyle | undefined): { align?: RichTextBlock['align']; rest?: RichStyle } {
  if (!style) return {}
  const rest: RichStyle = { ...style }
  const textAlign = rest.textAlign
  delete rest.textAlign
  const result: { align?: RichTextBlock['align']; rest?: RichStyle } = {}
  if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right' || textAlign === 'justify') {
    result.align = textAlign
  } else if (textAlign) {
    rest.textAlign = textAlign
  }
  if (Object.keys(rest).length) result.rest = rest
  return result
}

function makeBlock(type: RichTextBlock['type'], runs: TextRun[], extra: Partial<RichTextBlock> = {}): RichTextBlock {
  return { id: blockId(), type, ...extra, runs: runs.length ? runs : [{ text: '' }] }
}

function containsBlocks(node: RichElement): boolean {
  return (node.children ?? []).some(
    (child) => typeof child !== 'string' && (BLOCK_TAGS.has(child.tag) || LIST_TAGS.has(child.tag) || containsBlocks(child)),
  )
}

function listBlocks(node: RichElement, depth: number, out: RichTextBlock[]): void {
  const type = node.tag === 'ol' ? 'numbered-list' : 'bulleted-list'
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue
    if (child.tag === 'li') {
      const runs: TextRun[] = []
      const nested: RichElement[] = []
      for (const part of child.children ?? []) {
        if (typeof part !== 'string' && LIST_TAGS.has(part.tag)) nested.push(part)
        else inlineRuns([part], {}, runs)
      }
      out.push(makeBlock(type, trimRuns(runs), depth ? { depth } : {}))
      for (const list of nested) listBlocks(list, depth + 1, out)
    } else if (LIST_TAGS.has(child.tag)) {
      listBlocks(child, depth + 1, out)
    }
  }
}

function trimRuns(runs: TextRun[]): TextRun[] {
  if (!runs.length) return runs
  const first = runs[0]
  const last = runs[runs.length - 1]
  first.text = first.text.replace(/^\s+/, '')
  last.text = last.text.replace(/\s+$/, '')
  return runs.filter((run) => run.text !== '')
}

/**
 * The editor's view of a content tree: one block per paragraph, heading, list
 * item…, each holding styled runs. The separators between blocks are dropped
 * (they are inert) and come back in `blocksToRich`.
 */
export function richToBlocks(nodes: RichContent): RichTextDocument {
  const blocks: RichTextDocument = []
  let plain: TextRun[] = []

  const flushPlain = () => {
    const runs = trimRuns(plain)
    if (runs.length) blocks.push(makeBlock('plain', runs))
    plain = []
  }

  const visit = (list: RichNode[], marks: Marks) => {
    for (const node of list) {
      if (typeof node === 'string') {
        pushRun(plain, node, marks)
        continue
      }
      if (BLOCK_TAGS.has(node.tag)) {
        flushPlain()
        const runs: TextRun[] = []
        inlineRuns(node.children ?? [], marks, runs)
        const { align, rest } = alignOf(node.style)
        const extra: Partial<RichTextBlock> = {}
        if (align) extra.align = align
        if (rest) extra.style = rest
        if (node.tag === 'p') blocks.push(makeBlock('paragraph', trimRuns(runs), extra))
        else if (node.tag === 'blockquote') blocks.push(makeBlock('blockquote', trimRuns(runs), extra))
        else if (node.tag === 'div') blocks.push(makeBlock('div', trimRuns(runs), extra))
        else blocks.push(makeBlock('heading', trimRuns(runs), { ...extra, level: Number(node.tag[1]) as 1 }))
        continue
      }
      if (LIST_TAGS.has(node.tag)) {
        flushPlain()
        listBlocks(node, 0, blocks)
        continue
      }
      if (INLINE_TAGS.has(node.tag) && containsBlocks(node)) {
        // An inline wrapper around blocks (the opening-hours paragraphs on
        // /elerhetoseg/): its marks move onto the blocks it holds.
        flushPlain()
        const inner = richToBlocks(node.children ?? [])
        const pushed: Marks =
          node.tag === 'strong'
            ? { bold: true }
            : node.tag === 'em'
              ? { italic: true }
              : node.tag === 'u'
                ? { underline: true }
                : node.tag === 'a'
                  ? { href: node.href }
                  : { style: node.style }
        for (const block of inner) {
          block.runs = block.runs.map((run) => ({
            ...run,
            ...(pushed.bold ? { bold: true } : {}),
            ...(pushed.italic ? { italic: true } : {}),
            ...(pushed.underline ? { underline: true } : {}),
            ...(pushed.href && !run.href ? { href: pushed.href } : {}),
            ...(pushed.style ? { style: { ...pushed.style, ...run.style } } : {}),
          }))
          blocks.push(block)
        }
        continue
      }
      inlineRuns([node], marks, plain)
    }
  }
  visit(nodes, {})
  flushPlain()
  return blocks
}

/**
 * One value pattern per whitelisted style key - the narrowest that admits what
 * the mirror uses. Shared by the server's validator and the editor's inputs, so
 * the editor never offers what the server would refuse.
 */
export const RICH_STYLE_PATTERNS: Record<RichStyleKey, RegExp | 'color'> = {
  color: 'color',
  fontSize: /^(\d{1,3}(\.\d{1,2})?(px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/,
  fontFamily: /^[A-Za-z0-9 ,'"_-]{1,200}$/,
  fontWeight: /^(normal|bold|bolder|lighter|[1-9]00)$/,
  letterSpacing: /^(normal|-?\d{1,2}(\.\d{1,2})?(px|em|rem))$/,
  textTransform: /^(none|uppercase|lowercase|capitalize)$/,
  textAlign: /^(left|center|right|justify)$/,
  lineHeight: /^(normal|\d{1,3}(\.\d{1,2})?(px|em|rem|%)?)$/,
}

export function isValidStyleValue(key: RichStyleKey, value: string): boolean {
  const rule = RICH_STYLE_PATTERNS[key]
  return rule === 'color' ? isSafeColor(value) : rule.test(value)
}

/** True if every style key is one the content model allows - used by the validators. */
export function isRichStyleKey(key: string): key is (typeof RICH_STYLE_KEYS)[number] {
  return (RICH_STYLE_KEYS as readonly string[]).includes(key)
}
