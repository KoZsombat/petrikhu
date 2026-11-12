import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { PermissionCatalog } from "../lib/schemas";
import { checkbox, empty, muted } from "../lib/ui";

interface Props {
  catalog: PermissionCatalog | null;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function PermissionPicker({ catalog, value, onChange, disabled = false }: Props) {
  const groups = useMemo(() => {
    if (!catalog) return [];
    const map = new Map<string, typeof catalog.permissions>();
    for (const entry of catalog.permissions) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  if (catalog === null) {
    return (
      <p className={empty}>
        <Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Jogosultságok betöltése…
      </p>
    );
  }

  const toggle = (key: string) => {
    onChange(
      value.includes(key)
        ? value.filter((entry) => entry !== key)
        : [...value, key],
    );
  };

  return (
    <div className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto pr-1">
      {groups.map(([group, entries]) => (
        <fieldset key={group} className="rounded-lg border border-line-soft bg-cream/60 p-3">
          <legend className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
            {group}
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {entries.map((entry) => (
              <label key={entry.key} className={checkbox}>
                <input
                  type="checkbox"
                  checked={value.includes(entry.key)}
                  disabled={disabled}
                  onChange={() => toggle(entry.key)}
                />
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {value.length === 0 ? (
        <p className={muted}>Nincs kiválasztott jogosultság — a fiók csak be tud jelentkezni.</p>
      ) : null}
    </div>
  );
}
