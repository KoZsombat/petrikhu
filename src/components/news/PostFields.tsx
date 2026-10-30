import { useEffect, useState } from "react";
import type { ImagePosition, RichTextDocument, Term, TermKind } from "../../../shared/pnw/types";
import * as api from "../../lib/api";
import { ApiError } from "../../lib/api";
import { termsOfKind, useTerms } from "../../lib/terms";
import { emptyDocument, isBlank } from "../../../shared/pnw/richtext";
import { NEWS_TEMPLATES } from "../../../shared/pnw/news-templates";
import { btnCls, inputCls } from "../../pages/SchemaForm";
import { btnDanger, btnSmall, card, emptyCls, hintCls, labelCls } from "./ui";
import RichTextEditor from "./RichTextEditor";

type Props = {
  editorId: string;
  title: string;
  onTitleChange: (value: string) => void;
  content: RichTextDocument;
  onContentChange: (value: RichTextDocument) => void;
  excerpt: string;
  onExcerptChange: (value: string) => void;
  categoryIds: string[];
  onCategoryIdsChange: (value: string[]) => void;
  tagIds: string[];
  onTagIdsChange: (value: string[]) => void;
  /** `pnw_manage_terms`: shows the "new category/tag" row. */
  canCreateTerms: boolean;
  currentImage?: string;
  onImageChange: (file: File | null) => void;
  imagePosition: ImagePosition;
  onImagePositionChange: (value: ImagePosition) => void;
  /** Post templates above the title - for authors writing a new post. */
  templates?: boolean;
};

const TERM_ERROR_MESSAGES: Record<string, string> = {
  term_exists: "Ilyen nevű már van.",
  invalid_term_name: "Adj meg egy nevet (legfeljebb 60 karakter).",
  invalid_term_kind: "Ismeretlen típus.",
  forbidden: "Nincs jogosultságod újat létrehozni.",
};

/**
 * Common post fields (author, manager and published editing). Every category
 * is available to everyone; tags sit alongside, under the same rules.
 */
export default function PostFields({
  editorId,
  title,
  onTitleChange,
  content,
  onContentChange,
  excerpt,
  onExcerptChange,
  categoryIds,
  onCategoryIdsChange,
  tagIds,
  onTagIdsChange,
  canCreateTerms,
  currentImage,
  onImageChange,
  imagePosition,
  onImagePositionChange,
  templates = false,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  // Incrementing it rebuilds the (uncontrolled) file picker when the form is cleared.
  const [fileKey, setFileKey] = useState(0);
  const terms = useTerms();

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function handleFile(file: File | null): void {
    setPreview(file ? URL.createObjectURL(file) : null);
    onImageChange(file);
  }

  const shownImage = preview ?? currentImage;
  const template = NEWS_TEMPLATES.find((entry) => entry.id === templateId);

  /** Asks before replacing, and offers the template's title start. */
  function applyTemplate(): void {
    if (!template) return;
    if ((title.trim() || !isBlank(content)) && !window.confirm("A sablon a jelenlegi cím/szöveg egy részét lecserélheti. Biztosan alkalmazod?")) return;
    if (template.title && (!title.trim() || window.confirm("A sablonhoz tartozó címkezdetet is beírjuk?"))) onTitleChange(template.title);
    onContentChange(template.build());
  }

  /** Clears the whole form so the new post starts from a blank slate. */
  function clearForm(): void {
    if (!window.confirm("Biztosan kitörlöd a cím, a szöveg, a kivonat, a kategóriák, a címkék és a kép tartalmát?")) return;
    onTitleChange("");
    onContentChange(emptyDocument());
    onExcerptChange("");
    onCategoryIdsChange([]);
    onTagIdsChange([]);
    onImagePositionChange("top");
    setTemplateId("");
    handleFile(null);
    setFileKey((key) => key + 1);
  }

  return (
    <>
      {templates && (
        <div className="flex flex-col gap-3 rounded-lg border border-petrikline bg-petriktint p-4">
          <div>
            <strong className="block font-display text-lg">Hírsablonok</strong>
            <span className="text-sm text-petriksoft">Válassz egy típust, és előkészítjük a hír szerkezetét.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Hírsablon kiválasztása"
              className={`${inputCls} mt-0! max-w-xs flex-1`}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">— Válassz sablont —</option>
              {NEWS_TEMPLATES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <button type="button" className={`${btnCls} disabled:opacity-50`} disabled={!template} onClick={applyTemplate}>
              Sablon alkalmazása
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <small className="text-xs text-petriksoft">{template?.description ?? "Nem kötelező sablont használni."}</small>
            <button type="button" className={`${btnDanger} ${btnSmall}`} title="Mindent töröl, hogy tiszta lappal indulhass" onClick={clearForm}>
              Űrlap ürítése
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="pnw-title" className={labelCls}>
          Cím <span className="text-red-600">*</span>
        </label>
        <input id="pnw-title" type="text" required maxLength={200} className={inputCls} value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="A hír címe" />
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={editorId} className={labelCls}>
            Hír szövege <span className="text-red-600">*</span>
          </label>
          <small className="text-xs text-petrikfaint">Bekezdésenkénti szerkesztő - lásd a fenti eszköztárat.</small>
        </div>
        <div className="mt-1">
          <RichTextEditor id={editorId} value={content} onChange={onContentChange} />
        </div>
      </div>

      <div>
        <label htmlFor="pnw-excerpt" className={labelCls}>
          Rövid kivonat
        </label>
        <textarea id="pnw-excerpt" rows={3} maxLength={500} className={inputCls} value={excerpt} onChange={(event) => onExcerptChange(event.target.value)} placeholder="Opcionális rövid összefoglaló" />
        <small className={hintCls}>Ha a sablon használ kivonatot, ez jelenhet meg a hírlistában.</small>
      </div>

      <TermPicker
        kind="category"
        legend="Kategória"
        required
        emptyText="Még nincs egyetlen kategória sem."
        terms={terms}
        selectedIds={categoryIds}
        onChange={onCategoryIdsChange}
        canCreateTerms={canCreateTerms}
      />

      <TermPicker
        kind="tag"
        legend="Címkék"
        emptyText="Még nincs egyetlen címke sem - hozz létre egyet, ha van rá jogosultságod."
        terms={terms}
        selectedIds={tagIds}
        onChange={onTagIdsChange}
        canCreateTerms={canCreateTerms}
      />

      <div>
        <label htmlFor="pnw-featured" className={labelCls}>
          Kiemelt kép
        </label>
        <div className="mt-1 flex items-center gap-4 rounded-lg border border-petrikline bg-petrikcream p-3">
          {shownImage ? (
            <>
              <img src={shownImage} alt="Kiemelt kép előnézete" className="h-24 w-36 rounded-md object-cover" />
              <div className="text-sm">
                <strong className="block">Kiemelt kép</strong>
                <span className="text-petriksoft">Új fájl kiválasztásakor itt azonnal látod a cserét.</span>
              </div>
            </>
          ) : (
            <div className="text-sm">
              <strong className="block">Nincs még kiemelt kép</strong>
              <span className="text-petriksoft">A kiválasztott kép előnézete itt jelenik meg.</span>
            </div>
          )}
        </div>
        <input
          key={fileKey}
          id="pnw-featured"
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-petrikaccent file:bg-petrikcard file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-petrikaccentdark hover:file:bg-petrikaccent hover:file:text-petrikcard"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        <small className={hintCls}>JPG, PNG, WebP vagy GIF. Új kép feltöltésével a jelenlegi kiemelt kép lecserélődik.</small>
        <fieldset className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
          <legend className="mb-1 text-sm font-medium text-petriksoft">A kép helye a hírben</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="pnw-image-position" className="accent-petrikaccent" checked={imagePosition === "top"} onChange={() => onImagePositionChange("top")} />
            A szöveg felett
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="pnw-image-position" className="accent-petrikaccent" checked={imagePosition === "bottom"} onChange={() => onImagePositionChange("bottom")} />
            A szöveg alatt
          </label>
        </fieldset>
      </div>
    </>
  );
}

type PickerProps = {
  kind: TermKind;
  legend: string;
  required?: boolean;
  emptyText: string;
  terms: Term[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  canCreateTerms: boolean;
};

/**
 * A category or tag list with checkboxes. Every item is available to every account;
 * the "new" row is only shown with the `pnw_manage_terms` permission. A newly created
 * item is checked straight away.
 */
function TermPicker({ kind, legend, required, emptyText, terms, selectedIds, onChange, canCreateTerms }: PickerProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = termsOfKind(terms, kind);
  const placeholder = kind === "category" ? "Új kategória neve" : "Új címke neve";

  function toggle(id: string, checked: boolean): void {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((existing) => existing !== id));
  }

  async function create(): Promise<void> {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const term = await api.createTerm(kind, name);
      onChange([...selectedIds, term.id]);
      setNewName("");
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      setError(TERM_ERROR_MESSAGES[code] ?? "A létrehozás nem sikerült.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className={`${card} p-4!`}>
      <legend className="px-1 text-sm font-medium text-petriksoft">
        {legend} {required && <span className="text-red-600">*</span>}
      </legend>
      {visible.length === 0 ? (
        <div className={emptyCls}>{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((term) => (
            <label key={term.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-petrikaccent" checked={selectedIds.includes(term.id)} onChange={(event) => toggle(term.id, event.target.checked)} />
              <span>{term.name}</span>
            </label>
          ))}
        </div>
      )}

      {canCreateTerms && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            maxLength={60}
            className={`${inputCls} mt-0! max-w-xs`}
            value={newName}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // Here, Enter always creates, never saves.
              event.preventDefault();
              create();
            }}
          />
          <button type="button" className={`${btnCls} disabled:opacity-50`} disabled={busy || newName.trim() === ""} onClick={create}>
            + Létrehozás
          </button>
        </div>
      )}
      {error && <small className="mt-2 block text-xs text-red-700">{error}</small>}
    </fieldset>
  );
}
