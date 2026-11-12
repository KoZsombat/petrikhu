import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { iconButton } from "../lib/ui";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-start justify-items-center overflow-y-auto bg-ink/40 px-5 pb-10 pt-[6vh] backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line-soft bg-[#f7f4ec] px-5 py-4">
          <h2 className="font-display text-[21px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button className={iconButton} type="button" onClick={onClose} aria-label="Bezárás">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
