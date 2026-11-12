import { Check, FileText, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteMedia, listMedia, uploadMedia } from "../lib/api";
import { usePermissions } from "../lib/permissions";
import type { MediaItem } from "../lib/schemas";
import { buttonPrimary, empty, formError, iconButtonDanger, input, muted } from "../lib/ui";
import { Dialog } from "./Dialog";

type Kind = "image" | "document";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (url: string) => void;
  onSelectMany?: (urls: string[]) => void;
  multiple?: boolean;
  title?: string;
  kind?: Kind;
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  onSelectMany,
  multiple = false,
  title,
  kind = "image",
}: Props) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const permissions = usePermissions();
  const canView = permissions.has("media.view");
  const canUpload = permissions.has("media.upload");
  const canDelete = permissions.has("media.delete");

  const isDocument = kind === "document";
  const heading = title ?? (isDocument ? "Dokumentum kiválasztása" : "Kép kiválasztása");

  const refresh = async (reset = false, search = query) => {
    try {
      setError(null);
      const start = reset ? 0 : offset;
      const page = await listMedia(kind, start, 60, search);
      setItems((current) => (reset ? page : [...(current ?? []), ...page]));
      setOffset(start + page.length);
      setHasMore(page.length === 60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    if (!canView) {
      setItems([]);
      setError("Nincs médiatár-megtekintési jogosultságod.");
      return;
    }

    const timer = setTimeout(() => {
      setOffset(0);
      setHasMore(false);
      void refresh(true, query);
    }, query ? 250 : 0);

    return () => clearTimeout(timer);
  }, [open, canView, kind, query]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const created = await uploadMedia(file);
      await refresh(true, query);
      if (multiple) {
        setSelected((current) => new Set(current).add(created.url));
      } else {
        onSelect?.(created.url);
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Feltöltési hiba");
    } finally {
      setUploading(false);
    }
  };

  const pick = (item: MediaItem) => {
    if (!multiple) {
      onSelect?.(item.url);
      onClose();
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.url)) next.delete(item.url);
      else next.add(item.url);
      return next;
    });
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Törlöd: ${item.name}?`)) return;
    try {
      await deleteMedia(item.id);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  return (
    <Dialog
      open={open}
      title={heading}
      onClose={() => {
        setQuery("");
        onClose();
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            className={`${input} pl-9`}
            type="search"
            value={query}
            placeholder={isDocument ? "Dokumentum keresése…" : "Kép keresése…"}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {canUpload ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className={buttonPrimary}>
              <Upload className="size-4" aria-hidden />
              {uploading
                ? "Feltöltés…"
                : isDocument
                  ? "Új dokumentum feltöltése"
                  : "Új kép feltöltése"}
              <input
                type="file"
                accept={
                  isDocument
                    ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                    : "image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp"
                }
                hidden
                disabled={uploading}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
            <span className={muted}>
              {isDocument ? "PDF, Office, TXT, CSV, ZIP · max 25 MB" : "JPEG, PNG, WebP, AVIF, GIF · max 25 MB"}
            </span>
          </div>
        ) : null}

        {error ? <p className={formError}>{error}</p> : null}

        {items === null ? (
          <p className={empty}>Betöltés…</p>
        ) : items.length === 0 ? (
          <p className={empty}>
            {query
              ? "Nincs találat."
              : isDocument
                ? "Még nincs feltöltött dokumentum."
                : "Még nincs feltöltött kép."}
          </p>
        ) : isDocument ? (
          <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto p-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-line-soft bg-cream px-3 py-2.5 text-left transition hover:border-accent hover:bg-surface"
                type="button"
                title={item.name}
                onClick={() => pick(item)}
              >
                <FileText className="size-5 shrink-0 text-accent-dark" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{item.name}</span>
                <span className="shrink-0 text-[11px] text-faint">{formatSize(item.size)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid max-h-[52vh] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5 overflow-y-auto p-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                className={`relative overflow-hidden rounded-lg border p-0 text-left transition ${
                  selected.has(item.url)
                    ? "border-accent shadow-[0_0_0_2px_rgba(43,130,114,0.3)]"
                    : "border-line-soft hover:border-accent hover:shadow-[0_0_0_2px_rgba(43,130,114,0.18)]"
                }`}
                type="button"
                title={item.name}
                aria-pressed={multiple ? selected.has(item.url) : undefined}
                onClick={() => pick(item)}
              >
                <img className="block h-[84px] w-full bg-cream object-cover" src={item.url} alt={item.name} loading="lazy" />
                {multiple && selected.has(item.url) ? (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                ) : null}
                <span className="block truncate px-2 py-1 text-[11.5px] text-soft">{item.name}</span>
              </button>
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center">
            <button className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-soft transition hover:border-accent hover:text-ink" type="button" onClick={() => void refresh()}>
              Továbbiak betöltése
            </button>
          </div>
        ) : null}

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
            <span className={muted}>{selected.size} kép kiválasztva</span>
            <button
              className={buttonPrimary}
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                onSelectMany?.([...selected]);
                onClose();
              }}
            >
              Beszúrás ({selected.size})
            </button>
          </div>
        ) : null}

        {canDelete && items && items.length > 0 ? (
          <details>
            <summary className={muted}>{isDocument ? "Dokumentumok törlése" : "Képek törlése"}</summary>
            <div className="mt-2 flex max-h-[28vh] flex-col gap-2 overflow-y-auto">
              {items.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.id}>
                  <span className={`${muted} truncate`}>{item.name}</span>
                  <button className={iconButtonDanger} type="button" onClick={() => void remove(item)}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </Dialog>
  );
}
