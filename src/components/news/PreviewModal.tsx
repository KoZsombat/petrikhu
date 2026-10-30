import { useEffect } from "react";
import type { ImagePosition, RichTextDocument } from "../../../shared/pnw/types";
import { termNames, useTerms } from "../../lib/terms";
import PostArticle from "./PostArticle";
import { kicker } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: RichTextDocument;
  categoryIds: string[];
  tagIds: string[];
  image?: string;
  imagePosition?: ImagePosition;
};

/**
 * Gyors előnézet: a hír cikknézete (PostArticle) ugyanúgy, ahogy a nyilvános
 * oldalon megjelenik. A címkék nem részei a cikknézetnek, ezért fölötte, a
 * Hírkezelő saját sávjában látszanak.
 */
export default function PreviewModal({ open, onClose, title, content, categoryIds, tagIds, image, imagePosition }: Props) {
  const tags = termNames(useTerms(), tagIds);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pnw-preview-title">
      <div className="absolute inset-0 bg-petrikink/60" onClick={onClose} />
      <div className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-petrikbg shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-petriklinesoft bg-petrikcard px-5 py-3">
          <div>
            <div className={kicker}>Gyors előnézet</div>
            <strong id="pnw-preview-title" className="font-display text-lg">
              Így fog kinézni a hír az oldalon
            </strong>
          </div>
          <button type="button" className="size-8 rounded-full border border-petrikline text-lg leading-none text-petriksoft hover:bg-petriktint" onClick={onClose} aria-label="Előnézet bezárása">
            ×
          </button>
        </div>
        {tags.length > 0 && (
          <div className="border-b border-petriklinesoft bg-petriktint px-5 py-2 text-sm">
            <strong>Címkék:</strong> {tags.join(", ")}
          </div>
        )}
        <div className="overflow-y-auto bg-petrikbg">
          <PostArticle title={title} content={content} categoryIds={categoryIds} image={image} imagePosition={imagePosition} />
        </div>
      </div>
    </div>
  );
}
