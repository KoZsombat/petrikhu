/**
 * Pure data helpers over the RichTextDocument model (see types.ts) - no React,
 * so both the frontend editor/preview and the server's search filtering can
 * use the same "what is this block's plain text" logic.
 */
import type { BlockType, RichTextBlock, RichTextDocument } from './types.ts'

let counter = 0
function blockId(): string {
  counter += 1
  return `b${Date.now().toString(36)}${counter}`
}

export function emptyBlock(type: BlockType = 'paragraph'): RichTextBlock {
  return { id: blockId(), type, runs: [{ text: '' }] }
}

export function emptyDocument(): RichTextDocument {
  return [emptyBlock()]
}

/** The editor keeps one run per block (see RichTextEditor.tsx); this reads any block regardless. */
export function blockText(block: RichTextBlock): string {
  // A table's text is its cells, so a post that is only a table still counts as having content.
  if (block.type === 'table' && block.table) return block.table.rows.map((row) => row.join(' ')).join(' ')
  return block.runs.map((run) => run.text).join('')
}

export function emptyTable(rows = 3, columns = 3): RichTextBlock {
  const block = emptyBlock('table')
  block.table = { header: true, rows: Array.from({ length: rows }, () => Array.from({ length: columns }, () => '')) }
  return block
}

export function documentText(doc: RichTextDocument): string {
  return doc.map(blockText).join('\n')
}

/** A picture, a gallery or an embed is content even without a word of text. */
export function isMediaBlock(block: RichTextBlock): boolean {
  return block.type === 'image' || block.type === 'gallery' || block.type === 'embed'
}

export function isBlank(doc: RichTextDocument): boolean {
  return doc.every((block) => !isMediaBlock(block) && blockText(block).trim() === '')
}

/**
 * The only link targets a run (or a Szerkesztő button/image/menu item) may
 * carry: a root-relative in-app route, or an http(s)/mailto/tel URL. Anything
 * else - `javascript:` first of all - is dropped on save and ignored on render.
 */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  // `//host/path` - the mirror has one (a Facebook link on /projekt/); a plain anchor, like any absolute URL.
  return /^(https?:\/\/|\/\/[a-z0-9]|mailto:|tel:)/i.test(href)
}

/** `#rgb`/`#rrggbb`/`rgb()`/`rgba()` or a bare colour keyword - never anything that could close a style. */
export function isSafeColor(color: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]+\)|[a-z]+)$/i.test(color.trim())
}
