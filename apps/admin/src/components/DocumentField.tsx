import { FileText, X } from "lucide-react";
import { useState } from "react";
import { button, iconButton } from "../lib/ui";
import { MediaPickerDialog } from "./MediaPickerDialog";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

const fileName = (value: string) => {
  try {
    return decodeURIComponent(value.split("/").pop() ?? value);
  } catch {
    return value.split("/").pop() ?? value;
  }
};

export function DocumentField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-cream px-3 py-2.5">
          <FileText className="size-5 shrink-0 text-accent-dark" aria-hidden />
          <a className="min-w-0 flex-1 truncate text-[13px] font-medium underline underline-offset-2" href={value} target="_blank" rel="noreferrer">
            {fileName(value)}
          </a>
          <button className={iconButton} type="button" title="Dokumentum eltávolítása" onClick={() => onChange(null)}>
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <p className="text-xs text-faint">Nincs kiválasztott dokumentum. Védett dokumentumhoz hagyd üresen.</p>
      )}

      <div>
        <button className={button} type="button" onClick={() => setOpen(true)}>
          <FileText className="size-4" aria-hidden /> {value ? "Dokumentum cseréje" : "Dokumentum kiválasztása"}
        </button>
      </div>

      <MediaPickerDialog
        open={open}
        kind="document"
        title={value ? "Dokumentum cseréje" : "Dokumentum kiválasztása"}
        onClose={() => setOpen(false)}
        onSelect={(url) => onChange(url)}
      />
    </div>
  );
}
