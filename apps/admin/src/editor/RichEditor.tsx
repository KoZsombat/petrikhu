/** The TipTap editor with a toolbar. Produces exactly the TipTap JSON the server accepts (shared extensions). */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Heading3, Heading4, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Table2, Underline, Undo2, Unlink } from 'lucide-react'
import { editorExtensions } from '@petrik/shared/tiptap-extensions'
import { isSafeHref } from '@petrik/shared/links'
import type { RichDoc } from '@petrik/shared/tiptap'
import { cx } from '../ui.tsx'
import { MediaPicker } from './MediaPicker.tsx'

function ToolButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx('rounded p-1.5 text-petriksoft hover:bg-petriktint hover:text-petrikink disabled:opacity-40', active && 'bg-petriktint text-petrikaccentdark')}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const chain = () => editor.chain().focus()
  const link = () => {
    const current = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('A link címe (https://… vagy /oldal):', current ?? '')
    if (href === null) return
    if (!href) chain().unsetLink().run()
    else if (isSafeHref(href.trim())) chain().extendMarkRange('link').setLink({ href: href.trim() }).run()
    else window.alert('Csak https://, http://, mailto:, tel: vagy / kezdetű cím adható meg.')
  }
  const icon = 16
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-petriklinesoft bg-petrikcream px-2 py-1">
      <ToolButton label="Félkövér" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold size={icon} /></ToolButton>
      <ToolButton label="Dőlt" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic size={icon} /></ToolButton>
      <ToolButton label="Aláhúzott" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><Underline size={icon} /></ToolButton>
      <ToolButton label="Áthúzott" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough size={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-petrikline" />
      <ToolButton label="Címsor 2" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 size={icon} /></ToolButton>
      <ToolButton label="Címsor 3" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 size={icon} /></ToolButton>
      <ToolButton label="Címsor 4" active={editor.isActive('heading', { level: 4 })} onClick={() => chain().toggleHeading({ level: 4 }).run()}><Heading4 size={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-petrikline" />
      <ToolButton label="Felsorolás" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List size={icon} /></ToolButton>
      <ToolButton label="Számozott lista" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={icon} /></ToolButton>
      <ToolButton label="Idézet" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote size={icon} /></ToolButton>
      <ToolButton label="Elválasztó vonal" onClick={() => chain().setHorizontalRule().run()}><Minus size={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-petrikline" />
      <ToolButton label="Balra" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={icon} /></ToolButton>
      <ToolButton label="Középre" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={icon} /></ToolButton>
      <ToolButton label="Jobbra" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-petrikline" />
      <ToolButton label="Link" active={editor.isActive('link')} onClick={link}><Link2 size={icon} /></ToolButton>
      <ToolButton label="Link eltávolítása" disabled={!editor.isActive('link')} onClick={() => chain().unsetLink().run()}><Unlink size={icon} /></ToolButton>
      <ToolButton label="Kép" onClick={onImage}><ImagePlus size={icon} /></ToolButton>
      <ToolButton label="Táblázat" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={icon} /></ToolButton>
      {editor.isActive('table') && (
        <>
          <button type="button" className="rounded px-1.5 text-xs hover:bg-petriktint" onClick={() => chain().addRowAfter().run()}>+ sor</button>
          <button type="button" className="rounded px-1.5 text-xs hover:bg-petriktint" onClick={() => chain().addColumnAfter().run()}>+ oszlop</button>
          <button type="button" className="rounded px-1.5 text-xs hover:bg-petriktint" onClick={() => chain().deleteRow().run()}>− sor</button>
          <button type="button" className="rounded px-1.5 text-xs hover:bg-petriktint" onClick={() => chain().deleteColumn().run()}>− oszlop</button>
          <button type="button" className="rounded px-1.5 text-xs text-red-700 hover:bg-red-50" onClick={() => chain().deleteTable().run()}>táblázat törlése</button>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-petrikline" />
      <ToolButton label="Visszavonás" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 size={icon} /></ToolButton>
      <ToolButton label="Mégis" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 size={icon} /></ToolButton>
    </div>
  )
}

export function RichEditor({ value, onChange, label }: { value: RichDoc; onChange: (doc: RichDoc) => void; label?: string }) {
  const [picking, setPicking] = useState(false)
  const editor = useEditor({
    extensions: editorExtensions(),
    content: value,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'tiptap px-4 py-3', 'aria-label': label ?? 'Szöveg', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDoc),
  })
  if (!editor) return null
  return (
    <div className="overflow-hidden rounded-md border border-petrikline bg-white">
      <Toolbar editor={editor} onImage={() => setPicking(true)} />
      <EditorContent editor={editor} />
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(src) => {
            const alt = window.prompt('A kép rövid leírása (alternatív szöveg):', '') ?? ''
            editor.chain().focus().setImage({ src, alt }).run()
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
