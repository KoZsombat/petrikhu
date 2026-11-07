/**
 * Old sanitized HTML (the `html` fields of the previous Creator pages and pages.json) → TipTap JSON.
 * Only used by the seed and the legacy migration. Unknown tags keep their text; unsafe links are dropped.
 */
import { parseDocument } from 'htmlparser2'
import type { ChildNode, Element } from 'domhandler'
import { isEmbedSrc, isImageSrc, isSafeColor, isSafeHref } from '@petrik/shared/links'
import type { Mark, RichDoc, RichNode, TextAlign } from '@petrik/shared/tiptap'

type Block = RichNode

const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'table', 'hr', 'img', 'iframe'])

function styleOf(el: Element): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (el.attribs.style ?? '').split(';')) {
    const [key, ...rest] = part.split(':')
    if (key && rest.length) out[key.trim().toLowerCase()] = rest.join(':').trim()
  }
  return out
}

function alignOf(el: Element): TextAlign | null {
  const value = styleOf(el)['text-align'] ?? el.attribs.align
  return value === 'center' || value === 'right' || value === 'justify' ? value : null
}

function marksFor(el: Element, marks: Mark[]): Mark[] {
  const next = [...marks]
  const add = (mark: Mark) => {
    if (!next.some((m) => m.type === mark.type)) next.push(mark)
  }
  switch (el.name) {
    case 'strong':
    case 'b':
      add({ type: 'bold' })
      break
    case 'em':
    case 'i':
      add({ type: 'italic' })
      break
    case 'u':
      add({ type: 'underline' })
      break
    case 's':
    case 'del':
    case 'strike':
      add({ type: 'strike' })
      break
    case 'a': {
      const href = (el.attribs.href ?? '').trim()
      if (href && isSafeHref(href)) add({ type: 'link', attrs: { href } })
      break
    }
  }
  const style = styleOf(el)
  if (style['font-weight'] && /^(bold|[6-9]00)$/.test(style['font-weight'])) add({ type: 'bold' })
  if (style['font-style'] === 'italic') add({ type: 'italic' })
  if (style.color && isSafeColor(style.color)) add({ type: 'textStyle', attrs: { color: style.color } })
  return next
}

class Builder {
  blocks: Block[] = []
  private inline: RichNode[] = []
  private align: TextAlign | null = null

  pushText(text: string, marks: Mark[]) {
    const collapsed = text.replace(/\s+/g, ' ')
    if (!collapsed) return
    const last = this.inline[this.inline.length - 1]
    if (collapsed === ' ' && (!last || last.type === 'hardBreak')) return
    const node: RichNode = marks.length ? { type: 'text', text: collapsed, marks } : { type: 'text', text: collapsed }
    if (last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += collapsed
    else this.inline.push(node)
  }

  pushBreak() {
    this.inline.push({ type: 'hardBreak' })
  }

  /** Closes the running paragraph (if it has text) into `wrap` (default: a paragraph). */
  flush(wrap?: (content: RichNode[]) => Block) {
    while (this.inline.length && (this.inline[this.inline.length - 1].type === 'hardBreak' || isBlankText(this.inline[this.inline.length - 1]))) this.inline.pop()
    while (this.inline.length && (this.inline[0].type === 'hardBreak' || isBlankText(this.inline[0]))) this.inline.shift()
    if (this.inline.length) {
      const first = this.inline[0]
      if (first.type === 'text') first.text = first.text.replace(/^\s+/, '')
      const lastNode = this.inline[this.inline.length - 1]
      if (lastNode.type === 'text') lastNode.text = lastNode.text.replace(/\s+$/, '')
      const content = this.inline.filter((n) => n.type !== 'text' || n.text !== '')
      this.blocks.push(wrap ? wrap(content) : { type: 'paragraph', ...(this.align ? { attrs: { textAlign: this.align } } : {}), content })
    }
    this.inline = []
    this.align = null
  }

  setAlign(align: TextAlign | null) {
    this.align = align
  }
}

const isBlankText = (node: RichNode) => node.type === 'text' && node.text.trim() === ''

function imageNode(el: Element): Block | null {
  const src = (el.attribs.src ?? '').trim()
  if (!src || !isImageSrc(src)) return null
  const width = Number(el.attribs.width) || null
  const height = Number(el.attribs.height) || null
  return { type: 'image', attrs: { src, alt: el.attribs.alt ?? '', width, height } }
}

function walk(nodes: ChildNode[], builder: Builder, marks: Mark[]): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      builder.pushText((node as unknown as { data: string }).data, marks)
      continue
    }
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') continue
    const el = node as Element
    const name = el.name.toLowerCase()
    if (name === 'script' || name === 'style') continue
    if (name === 'br') {
      builder.pushBreak()
      continue
    }
    if (!BLOCK_TAGS.has(name)) {
      walk(el.children, builder, marksFor(el, marks))
      continue
    }
    builder.flush()
    if (name in HEADINGS) {
      const inner = new Builder()
      walk(el.children, inner, marks)
      inner.flush((content) => ({ type: 'heading', attrs: { level: HEADINGS[name], textAlign: alignOf(el) }, content }))
      builder.blocks.push(...inner.blocks.map((b) => (b.type === 'paragraph' ? { type: 'heading' as const, attrs: { level: HEADINGS[name] }, content: b.content } : b)))
    } else if (name === 'ul' || name === 'ol') {
      const items = el.children.filter((c): c is Element => c.type === 'tag' && (c as Element).name === 'li')
      const listItems: Block[] = items.map((li) => {
        const inner = new Builder()
        walk(li.children, inner, marks)
        inner.flush()
        return { type: 'listItem', content: inner.blocks.length ? inner.blocks : [{ type: 'paragraph' }] }
      })
      if (listItems.length) builder.blocks.push(name === 'ul' ? { type: 'bulletList', content: listItems } : { type: 'orderedList', content: listItems })
    } else if (name === 'blockquote') {
      const inner = new Builder()
      walk(el.children, inner, marks)
      inner.flush()
      if (inner.blocks.length) builder.blocks.push({ type: 'blockquote', content: inner.blocks })
    } else if (name === 'table') {
      const rows: Block[] = []
      const collect = (children: ChildNode[]) => {
        for (const child of children) {
          if (child.type !== 'tag') continue
          const c = child as Element
          if (c.name === 'tr') {
            const cells = c.children.filter((x): x is Element => x.type === 'tag' && ((x as Element).name === 'td' || (x as Element).name === 'th'))
            rows.push({
              type: 'tableRow',
              content: cells.map((cell) => {
                const inner = new Builder()
                walk(cell.children, inner, marks)
                inner.flush()
                return { type: cell.name === 'th' ? 'tableHeader' : 'tableCell', content: inner.blocks.length ? inner.blocks : [{ type: 'paragraph' }] } as Block
              }),
            })
          } else collect(c.children)
        }
      }
      collect(el.children)
      if (rows.length) builder.blocks.push({ type: 'table', content: rows })
    } else if (name === 'hr') {
      builder.blocks.push({ type: 'horizontalRule' })
    } else if (name === 'img') {
      const image = imageNode(el)
      if (image) builder.blocks.push(image)
    } else if (name === 'iframe') {
      const src = (el.attribs.src ?? '').trim()
      if (isEmbedSrc(src)) builder.blocks.push({ type: 'embed', attrs: { src, title: el.attribs.title ?? null, aspect: 0.5625 } })
    } else {
      // p, div, section, figure…: its own paragraph(s); images inside become blocks of their own
      builder.setAlign(alignOf(el))
      walk(el.children, builder, marks)
      builder.flush()
    }
  }
}

export function htmlToTiptap(html: string): RichDoc {
  const dom = parseDocument(html, { decodeEntities: true })
  const builder = new Builder()
  walk(dom.children, builder, [])
  builder.flush()
  const content = builder.blocks
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/** A plain text field (with line breaks) as a document. */
export function textToTiptap(text: string): RichDoc {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  return {
    type: 'doc',
    content: paragraphs.length
      ? paragraphs.map((part) => ({
          type: 'paragraph' as const,
          content: part.split('\n').flatMap((line, i): RichNode[] => (i ? [{ type: 'hardBreak' }, { type: 'text', text: line }] : [{ type: 'text', text: line }])).filter((n) => n.type !== 'text' || n.text !== ''),
        }))
      : [{ type: 'paragraph' }],
  }
}
