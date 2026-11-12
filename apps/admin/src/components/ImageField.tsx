import { Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import { button, iconButton } from "../lib/ui";
import { MediaPickerDialog } from "./MediaPickerDialog";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ImageField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img className="size-16 rounded-lg border border-line-soft bg-[#f7f4ec] object-cover" src={value} alt="" />
      ) : (
        <span className="grid size-16 place-items-center rounded-lg border border-dashed border-line bg-[#f7f4ec] text-faint">
          <ImageIcon className="size-4" aria-hidden />
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} type="button" onClick={() => setOpen(true)}>
          <ImageIcon className="size-4" aria-hidden />
          {value ? "Kép cseréje" : "Kép kiválasztása"}
        </button>
        {value ? (
          <button className={iconButton} type="button" title="Kép eltávolítása" onClick={() => onChange(null)}>
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <MediaPickerDialog open={open} onClose={() => setOpen(false)} onSelect={(url) => onChange(url)} />
    </div>
  );
}
