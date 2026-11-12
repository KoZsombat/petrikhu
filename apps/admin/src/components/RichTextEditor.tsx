import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Images,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { useState } from "react";
import { Gallery } from "../lib/gallery-extension";
import { MediaPickerDialog } from "./MediaPickerDialog";

interface Props {
  initialContent: string;
  onChange: (html: string, text: string) => void;
}

const toolbarButton =
  "inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-soft transition-colors hover:bg-tint hover:text-accent-dark";
const toolbarActive = "bg-tint text-accent-dark";

export function RichTextEditor({ initialContent, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Gallery,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent || "<p></p>",
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML(), instance.getText({ blockSeparator: "\n\n" }));
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] outline-none [&_p]:mb-3 [&_p]:leading-relaxed [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-[3px] [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-soft [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-tint [&_th]:p-1.5 [&_th]:font-semibold [&_div[data-gallery]]:my-3 [&_div[data-gallery]]:grid [&_div[data-gallery]]:grid-cols-3 [&_div[data-gallery]]:gap-2 [&_div[data-gallery]_img]:aspect-[4/3] [&_div[data-gallery]_img]:w-full [&_div[data-gallery]_img]:rounded-md [&_div[data-gallery]_img]:object-cover",
      },
    },
  });

  if (!editor) {
    return <div className="h-[240px] rounded-lg border border-line bg-surface" />;
  }

  const button = (label: string, icon: React.ReactNode, action: () => void, active = false) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`${toolbarButton} ${active ? toolbarActive : ""}`}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line-soft bg-cream p-1.5">
        {button("Félkövér", <Bold className="size-4" />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {button("Dőlt", <Italic className="size-4" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {button("Áthúzott", <Strikethrough className="size-4" />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        <span className="mx-1 my-0.5 w-px bg-line-soft" />
        {button("Cím 2", <Heading2 className="size-4" />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
        {button("Cím 3", <Heading3 className="size-4" />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
        <span className="mx-1 my-0.5 w-px bg-line-soft" />
        {button("Felsorolás", <List className="size-4" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {button("Számozott lista", <ListOrdered className="size-4" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {button("Idézet", <Quote className="size-4" />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        <span className="mx-1 my-0.5 w-px bg-line-soft" />
        {button(
          "Hivatkozás",
          <LinkIcon className="size-4" />,
          () => {
            const href = window.prompt("Hivatkozás URL-je", "https://");
            if (!href) return;
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
          },
          editor.isActive("link"),
        )}
        {button("Kép beszúrása", <ImageIcon className="size-4" />, () => setPickerOpen(true))}
        {button("Galéria beszúrása", <Images className="size-4" />, () => setGalleryOpen(true))}
        <span className="flex items-center gap-1 rounded-md border border-line-soft bg-surface px-1 py-0.5">
          <TableIcon className="size-4 text-soft" aria-hidden />
          <select
            className="bg-transparent text-[11px] text-soft outline-none"
            title="Táblázat sorai"
            aria-label="Táblázat sorai"
            value={tableRows}
            onChange={(event) => setTableRows(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6, 7, 8].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
          <span className="text-[11px] text-faint">×</span>
          <select
            className="bg-transparent text-[11px] text-soft outline-none"
            title="Táblázat oszlopai"
            aria-label="Táblázat oszlopai"
            value={tableCols}
            onChange={(event) => setTableCols(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6, 7, 8].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-accent-dark hover:bg-tint"
            onClick={() => editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run()}
          >
            Beszúrás
          </button>
        </span>
        <span className="mx-1 my-0.5 w-px bg-line-soft" />
        {button("Visszavonás", <Undo2 className="size-4" />, () => editor.chain().focus().undo().run())}
        {button("Újra", <Redo2 className="size-4" />, () => editor.chain().focus().redo().run())}
      </div>

      <div className="max-h-[55vh] min-h-[240px] overflow-y-auto px-4 py-3.5">
        <EditorContent editor={editor} />
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Kép beszúrása a tartalomba"
        onSelect={(url) => editor.chain().focus().setImage({ src: url }).run()}
      />

      <MediaPickerDialog
        open={galleryOpen}
        multiple
        onClose={() => setGalleryOpen(false)}
        title="Galéria beszúrása"
        onSelectMany={(images) =>
          editor.chain().focus().insertContent({ type: "gallery", attrs: { images } }).run()
        }
      />
    </div>
  );
}
