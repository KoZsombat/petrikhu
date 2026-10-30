import { useRef, useState } from "react";
import { uploadPostImage } from "../../lib/api";
import type { CSSProperties, ReactNode } from "react";
import type { Align, BlockType, RichTable, RichTextBlock, RichTextDocument, TextRun } from "../../../shared/pnw/types";
import { blockText, emptyBlock, emptyTable, isMediaBlock } from "../../../shared/pnw/richtext";
import { MediaBlock } from "../RichContent";
import { btnCls } from "../../pages/SchemaForm";
import { btnSmall } from "./ui";

const MEDIA_LABELS: Partial<Record<BlockType, string>> = { image: "Kép", gallery: "Galéria", embed: "Beágyazott tartalom" };

type Props = {
  id: string;
  value: RichTextDocument;
  onChange: (next: RichTextDocument) => void;
};

const toolBtn =
  "min-w-9 rounded-md border border-petrikline bg-petrikcard px-2 py-1 text-sm text-petriksoft transition-colors hover:bg-petriktint";
const toolBtnOn = "border-petrikaccent! bg-petrikaccent! text-petrikcard! hover:bg-petrikaccentdark!";
const removeBtn =
  "absolute right-2 top-2 size-6 rounded-full border border-petrikline bg-petrikcard text-sm leading-none text-petriksoft hover:border-red-600 hover:bg-red-600 hover:text-white";

/**
 * Strukturált szövegszerkesztő, nem TinyMCE és nem egyetlen textarea: nyers HTML
 * sehol sincs. Minden blokk egy "run" (egy szöveg saját félkövér/dőlt/igazítás
 * jelzéssel), sima <textarea>-ban szerkesztve, amit élőben a run saját
 * formázásával stíluzunk. Az eszköztár visszavonása a blokkszerkezetre
 * működik (hozzáadás, törlés, formázás, típusváltás); a blokkon belüli
 * gépelésnél a textarea saját visszavonása él.
 */
export default function RichTextEditor({ id, value, onChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(value[0]?.id ?? null);
  const history = useRef<RichTextDocument[]>([]);
  const future = useRef<RichTextDocument[]>([]);
  const editSnapshot = useRef<RichTextDocument | null>(null);

  const active = value.find((block) => block.id === activeId);

  function commit(next: RichTextDocument, snapshot: RichTextDocument = value): void {
    history.current = [...history.current, snapshot];
    future.current = [];
    onChange(next);
  }

  function updateActive(updater: (block: RichTextBlock) => RichTextBlock): void {
    if (!active) return;
    commit(value.map((block) => (block.id === active.id ? updater(block) : block)));
  }

  function setText(blockId: string, text: string): void {
    onChange(value.map((block) => (block.id === blockId ? { ...block, runs: editRuns(block.runs, text) } : block)));
  }

  function addBlock(): void {
    const block = emptyBlock();
    commit([...value, block]);
    setActiveId(block.id);
  }

  /** 3×3-as táblázat (fejlécsorral) az aktív blokk után, vagy a végén. */
  function addTable(): void {
    const block = emptyTable();
    const at = active ? value.findIndex((entry) => entry.id === active.id) + 1 : value.length;
    commit([...value.slice(0, at), block, ...value.slice(at)]);
    setActiveId(block.id);
  }

  const imageInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** A kiválasztott képek feltöltése; egy kép képblokk lesz, több galéria. Az aktív blokk után, vagy a végén kerül be. */
  async function insertImages(files: FileList | null, asGallery: boolean): Promise<void> {
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push((await uploadPostImage(file)).url);
      const block = emptyBlock(asGallery ? "gallery" : "image");
      if (asGallery) block.gallery = urls.map((src) => ({ src, alt: "" }));
      else block.image = { src: urls[0], alt: "" };
      const at = active ? value.findIndex((entry) => entry.id === active.id) + 1 : value.length;
      commit([...value.slice(0, at), block, ...value.slice(at)]);
      setActiveId(block.id);
    } catch {
      setUploadError("A kép feltöltése nem sikerült (legfeljebb 8 MB, jpg/png/gif/webp/svg/avif).");
    }
  }

  function setMedia(blockId: string, patch: Partial<RichTextBlock>): void {
    commit(value.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function setTable(blockId: string, table: RichTable, record: boolean): void {
    const next = value.map((block) => (block.id === blockId ? { ...block, table } : block));
    if (record) commit(next);
    else onChange(next);
  }

  function removeBlock(blockId: string): void {
    if (value.length <= 1) return;
    const index = value.findIndex((block) => block.id === blockId);
    commit(value.filter((block) => block.id !== blockId));
    const fallback = value[index - 1] ?? value[index + 1];
    setActiveId(fallback ? fallback.id : null);
  }

  function undo(): void {
    const previous = history.current[history.current.length - 1];
    if (!previous) return;
    history.current = history.current.slice(0, -1);
    future.current = [...future.current, value];
    onChange(previous);
  }

  function redo(): void {
    const next = future.current[future.current.length - 1];
    if (!next) return;
    future.current = future.current.slice(0, -1);
    history.current = [...history.current, value];
    onChange(next);
  }

  function toggleRun(key: "bold" | "italic"): void {
    // A blokk minden run-jára, hogy egy átvett bekezdés megtartsa a linkjeit (editRuns).
    updateActive((block) => {
      const on = !block.runs[0]?.[key];
      return { ...block, runs: block.runs.map((run) => ({ ...run, [key]: on })) };
    });
  }

  function setAlign(align: Align): void {
    updateActive((block) => ({ ...block, align }));
  }

  function toggleListType(type: "bulleted-list" | "numbered-list"): void {
    updateActive((block) => ({ ...block, type: block.type === type ? "paragraph" : type }));
  }

  function clearFormatting(): void {
    updateActive((block) => ({ ...block, align: undefined, runs: [{ text: blockText(block) }] }));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-petrikline bg-petrikcard" id={id}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-petriklinesoft bg-petrikcream p-2" role="toolbar" aria-label="Formázás">
        <select
          className="rounded-md border border-petrikline bg-petrikcard px-2 py-1.5 text-sm disabled:opacity-50"
          aria-label="Bekezdés stílusa"
          value={active?.type === "heading" ? "heading" : "paragraph"}
          disabled={active?.type === "table" || (!!active && isMediaBlock(active))}
          onChange={(event) => updateActive((block) => ({ ...block, type: event.target.value as BlockType }))}
        >
          <option value="paragraph">Bekezdés</option>
          <option value="heading">Cím</option>
        </select>

        <ToolbarButton label="Félkövér" active={!!active?.runs[0]?.bold} onClick={() => toggleRun("bold")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Dőlt" active={!!active?.runs[0]?.italic} onClick={() => toggleRun("italic")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Felsorolás" active={active?.type === "bulleted-list"} onClick={() => toggleListType("bulleted-list")}>
          •≡
        </ToolbarButton>
        <ToolbarButton label="Számozott lista" active={active?.type === "numbered-list"} onClick={() => toggleListType("numbered-list")}>
          1≡
        </ToolbarButton>
        <ToolbarButton
          label="Idézet"
          active={active?.type === "blockquote"}
          onClick={() => updateActive((block) => ({ ...block, type: block.type === "blockquote" ? "paragraph" : "blockquote" }))}
        >
          “”
        </ToolbarButton>
        <ToolbarButton label="Balra igazítás" active={(active?.align ?? "left") === "left"} onClick={() => setAlign("left")}>
          ⇤
        </ToolbarButton>
        <ToolbarButton label="Középre igazítás" active={active?.align === "center"} onClick={() => setAlign("center")}>
          ⇔
        </ToolbarButton>
        <ToolbarButton label="Jobbra igazítás" active={active?.align === "right"} onClick={() => setAlign("right")}>
          ⇥
        </ToolbarButton>
        <ToolbarButton label="Táblázat beszúrása" active={active?.type === "table"} onClick={addTable}>
          <span className="px-1">⊞ Táblázat</span>
        </ToolbarButton>
        <ToolbarButton label="Kép beszúrása" onClick={() => imageInput.current?.click()}>
          <span className="px-1">🖼 Kép</span>
        </ToolbarButton>
        <ToolbarButton label="Galéria beszúrása (több kép)" onClick={() => galleryInput.current?.click()}>
          <span className="px-1">▦ Galéria</span>
        </ToolbarButton>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            insertImages(event.target.files, false);
            event.target.value = "";
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            insertImages(event.target.files, true);
            event.target.value = "";
          }}
        />
        <ToolbarButton label="Visszavonás" onClick={undo}>
          ↶
        </ToolbarButton>
        <ToolbarButton label="Ismétlés" onClick={redo}>
          ↷
        </ToolbarButton>
        <ToolbarButton label="Formázás törlése" onClick={clearFormatting}>
          Tx
        </ToolbarButton>
      </div>

      {uploadError && <p className="bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>}
      <div className="flex flex-col gap-1 p-3">
        {value.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            active={block.id === activeId}
            removable={value.length > 1}
            onFocus={() => {
              setActiveId(block.id);
              editSnapshot.current = value;
            }}
            onBlur={() => {
              if (editSnapshot.current && editSnapshot.current !== value) {
                history.current = [...history.current, editSnapshot.current];
                future.current = [];
              }
              editSnapshot.current = null;
            }}
            onChangeText={(text) => setText(block.id, text)}
            onChangeTable={(table, record) => setTable(block.id, table, record)}
            onChangeMedia={(patch) => setMedia(block.id, patch)}
            onUploadMore={async (files) => {
              try {
                const urls = [];
                for (const file of Array.from(files)) urls.push((await uploadPostImage(file)).url);
                setMedia(block.id, { gallery: [...(block.gallery ?? []), ...urls.map((src) => ({ src, alt: "" }))] });
              } catch {
                setUploadError("A kép feltöltése nem sikerült (legfeljebb 8 MB, jpg/png/gif/webp/svg/avif).");
              }
            }}
            onRemove={() => removeBlock(block.id)}
          />
        ))}
      </div>

      <button
        type="button"
        className="block w-full border-t border-dashed border-petrikline bg-petrikcream py-2.5 text-sm font-semibold text-petrikaccentdark hover:bg-petriktint"
        onClick={addBlock}
      >
        + Új bekezdés
      </button>
    </div>
  );
}

/**
 * Egy textarea-szerkesztés alkalmazása a blokk run-jaira. Itt írt hírnek
 * blokkonként egy run-ja van, az átvettnek több (link, félkövér szó), és ezeket
 * egyetlen run-ként újraírni az első betűnél elveszítené. A szerkesztés a
 * változatlan eleje és vége közti szakasz; csak az érintett run-ok változnak,
 * az új szöveg abba a run-ba kerül, amibe gépelték.
 */
function editRuns(runs: TextRun[], text: string): TextRun[] {
  if (runs.length <= 1) return [{ ...runs[0], text }];
  const old = runs.map((run) => run.text).join("");
  let start = 0;
  while (start < old.length && start < text.length && old[start] === text[start]) start += 1;
  let end = 0;
  while (end < old.length - start && end < text.length - start && old[old.length - 1 - end] === text[text.length - 1 - end]) end += 1;
  const removeTo = old.length - end;
  const inserted = text.slice(start, text.length - end);

  const out: TextRun[] = [];
  let offset = 0;
  let placed = false;
  for (const run of runs) {
    const from = offset;
    const to = offset + run.text.length;
    offset = to;
    let next = run.text;
    // Határon gépelve az előtte lévő run folytatódik.
    const hosts = !placed && start >= from && (start < to || (start === to && start > 0));
    if (to > start && from < removeTo) {
      next = run.text.slice(0, Math.max(0, start - from)) + (hosts ? inserted : "") + run.text.slice(Math.max(0, removeTo - from));
    } else if (hosts) {
      next = run.text.slice(0, start - from) + inserted + run.text.slice(start - from);
    }
    if (hosts) placed = true;
    if (next) out.push({ ...run, text: next });
  }
  if (!placed && inserted) out.unshift({ ...runs[0], text: inserted });
  return out.length ? out : [{ text: "" }];
}

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`${toolBtn} ${active ? toolBtnOn : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      // A fókusz (és a visszavonási pillanatkép) a blokk textarea-ján marad, különben a kattintás előbb elvenné.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BlockRow({
  block,
  active,
  removable,
  onFocus,
  onBlur,
  onChangeText,
  onChangeTable,
  onChangeMedia,
  onUploadMore,
  onRemove,
}: {
  block: RichTextBlock;
  active: boolean;
  removable: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeText: (text: string) => void;
  onChangeTable: (table: RichTable, record: boolean) => void;
  onChangeMedia: (patch: Partial<RichTextBlock>) => void;
  onUploadMore: (files: FileList) => void;
  onRemove: () => void;
}) {
  const frame = `relative rounded-md border ${active ? "border-petrikaccent bg-petrikcream" : "border-transparent hover:border-petriklinesoft"}`;

  if (isMediaBlock(block)) {
    // Régi oldalról átvett kép, galéria vagy beágyazás: megmarad és úgy látszik, ahogy lesz, de itt nem szerkeszthető.
    return (
      <div className={`${frame} p-3 pr-10`} tabIndex={0} onFocus={onFocus} onBlur={onBlur}>
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-petrikfaint">
          {MEDIA_LABELS[block.type]}
          {block.type === "embed" && " – a régi oldalról, itt nem szerkeszthető"}
        </span>
        <MediaBlock block={block} />
        {block.type === "image" && block.image && (
          <label className="mt-3 block text-sm font-medium text-petriksoft">
            Képleírás (alt szöveg)
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-petrikline bg-petrikcard px-3 py-1.5 text-sm"
              value={block.image.alt}
              maxLength={300}
              onChange={(event) => onChangeMedia({ image: { ...block.image!, alt: event.target.value } })}
            />
          </label>
        )}
        {block.type === "gallery" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className={`${btnCls} ${btnSmall} cursor-pointer`}>
              + Kép a galériához
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files) onUploadMore(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {(block.gallery?.length ?? 0) > 1 && (
              <button type="button" className={`${btnCls} ${btnSmall}`} onClick={() => onChangeMedia({ gallery: block.gallery!.slice(0, -1) })}>
                − Utolsó kép
              </button>
            )}
            <span className="text-xs text-petrikfaint">{block.gallery?.length ?? 0} kép</span>
          </div>
        )}
        {removable && (
          <button type="button" className={removeBtn} aria-label={`${MEDIA_LABELS[block.type]} törlése`} onClick={onRemove}>
            ×
          </button>
        )}
      </div>
    );
  }

  if (block.type === "table" && block.table) {
    return (
      <div className={`${frame} p-3 pr-10`} onFocus={onFocus}>
        <TableEditor table={block.table} onChange={onChangeTable} />
        {removable && (
          <button type="button" className={removeBtn} aria-label="Táblázat törlése" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
    );
  }

  const isList = block.type === "bulleted-list" || block.type === "numbered-list";
  const style: CSSProperties = {
    fontWeight: block.runs[0]?.bold ? 700 : undefined,
    fontStyle: block.runs[0]?.italic ? "italic" : undefined,
    textAlign: block.align === "justify" ? "justify" : block.align,
  };
  const typeCls =
    block.type === "heading"
      ? "font-display text-2xl font-bold"
      : block.type === "blockquote"
        ? "border-l-4 border-petrikaccent pl-3 font-display italic"
        : "text-[15px]";

  return (
    <div className={`${frame} flex items-start gap-2 pr-10`}>
      {isList && <span className="select-none pl-2 pt-2 font-mono text-petrikaccentdark">{block.type === "bulleted-list" ? "•" : "#"}</span>}
      <textarea
        className={`block min-h-10 w-full resize-y rounded-md bg-transparent px-3 py-2 text-petrikink placeholder:text-petrikfaint focus:outline-none ${typeCls}`}
        value={blockText(block)}
        rows={block.type === "heading" ? 1 : 2}
        placeholder={block.type === "heading" ? "Cím" : "Szöveg"}
        style={style}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(event) => onChangeText(event.target.value)}
      />
      {removable && (
        <button type="button" className={removeBtn} aria-label="Bekezdés törlése" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}

const MAX_ROWS = 100;
const MAX_COLUMNS = 30;

/**
 * A táblázatblokk szerkesztője: cellánként egy input, sor/oszlop hozzáadás és
 * törlés, fejlécsor-kapcsoló. A cellák sima szövegek, így táblázat sem hordozhat
 * jelölést. A szerkezeti változás visszavonási lépés, a cellába gépelés nem.
 */
function TableEditor({ table, onChange }: { table: RichTable; onChange: (table: RichTable, record: boolean) => void }) {
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const pad = (row: string[]) => [...row, ...Array.from({ length: columns - row.length }, () => "")];
  const rows = table.rows.map(pad);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btnCls} ${btnSmall}`} disabled={rows.length >= MAX_ROWS} onClick={() => onChange({ ...table, rows: [...rows, Array.from({ length: columns }, () => "")] }, true)}>
          + Sor
        </button>
        <button type="button" className={`${btnCls} ${btnSmall}`} disabled={rows.length <= 1} onClick={() => onChange({ ...table, rows: rows.slice(0, -1) }, true)}>
          − Sor
        </button>
        <button type="button" className={`${btnCls} ${btnSmall}`} disabled={columns >= MAX_COLUMNS} onClick={() => onChange({ ...table, rows: rows.map((row) => [...row, ""]) }, true)}>
          + Oszlop
        </button>
        <button type="button" className={`${btnCls} ${btnSmall}`} disabled={columns <= 1} onClick={() => onChange({ ...table, rows: rows.map((row) => row.slice(0, -1)) }, true)}>
          − Oszlop
        </button>
        <label className="flex items-center gap-1.5 text-sm text-petriksoft">
          <input type="checkbox" className="accent-petrikaccent" checked={table.header} onChange={(event) => onChange({ ...table, rows, header: event.target.checked }, true)} />
          Fejlécsor
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, rowAt) => (
              <tr key={rowAt} className={table.header && rowAt === 0 ? "bg-petriktint font-semibold" : undefined}>
                {row.map((cell, at) => (
                  <td key={at} className="border border-petrikline p-0">
                    <input
                      type="text"
                      value={cell}
                      aria-label={`${rowAt + 1}. sor, ${at + 1}. oszlop`}
                      maxLength={2000}
                      className="block w-full min-w-24 bg-transparent px-2 py-1.5 text-sm font-[inherit] focus:bg-petrikcard focus:outline-none focus:ring-2 focus:ring-inset focus:ring-petrikaccent/40"
                      onChange={(event) =>
                        onChange(
                          { ...table, rows: rows.map((r, i) => (i === rowAt ? r.map((c, j) => (j === at ? event.target.value : c)) : r)) },
                          false,
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
