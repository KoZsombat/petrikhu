/**
 * The TipTap editor configuration (admin only). It produces exactly the node and mark set that
 * tiptap.ts validates and the public site renders: anything else is not offered.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { isSafeHref } from './links.ts'

/** Pictures keep their link, caption and size (news imported from the old site use them). */
const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: { default: null },
      caption: { default: null },
      textAlign: { default: null },
    }
  },
}).configure({ inline: false })

/** A gallery of an imported news post; kept, shown as a strip, not editable item by item. */
const Gallery = Node.create({
  name: 'gallery',
  group: 'block',
  atom: true,
  addAttributes() {
    return { items: { default: [] } }
  },
  parseHTML() {
    return [{ tag: 'div[data-gallery]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const items = (node.attrs.items as { src: string; alt: string }[]) ?? []
    return ['div', mergeAttributes(HTMLAttributes, { 'data-gallery': '', class: 'tiptap-gallery' }), ...items.map((item) => ['img', { src: item.src, alt: item.alt }])]
  },
})

/** An embedded frame (YouTube, Sway…) of an imported news post. */
const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: '' }, title: { default: null }, aspect: { default: null }, height: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-embed': '', class: 'tiptap-embed' }), `▶ ${node.attrs.title ?? node.attrs.src}`]
  },
})

export function editorExtensions(): Extensions {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      link: { openOnClick: false, autolink: true, isAllowedUri: (url) => isSafeHref(url) },
    }),
    RichImage,
    TableKit.configure({ table: { resizable: false } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    Gallery,
    Embed,
  ]
}
