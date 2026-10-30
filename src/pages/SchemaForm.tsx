import { uploadMedia } from "../lib/api";
import type { Field, Fields } from "./creatorSchema";
import { emptyValues } from "./creatorSchema";

type Values = Record<string, unknown>;

export const inputCls =
  "mt-1 block w-full rounded-md border border-petrikline bg-petrikcard px-3 py-2 font-body text-sm text-petrikink placeholder:text-petrikfaint focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25";
export const btnCls =
  "rounded-md border border-petrikaccent px-3 py-1.5 text-sm font-semibold text-petrikaccentdark transition-colors hover:bg-petrikaccent hover:text-petrikcard";


function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span>
      {field.label}
      {field.required && " *"}
    </span>
  );

  switch (field.type) {
    case "text":
    case "url":
    case "image":
      return (
        <label className="my-3 block font-body text-sm font-medium text-petriksoft">
          {label}
          <input
            className={inputCls}
            type={field.type === "url" ? "url" : "text"}
            placeholder={field.type === "image" ? "Kép URL" : undefined}
            value={(value as string) ?? ""}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.type === "image" && (
            // Feltöltés a szerver médiatárába; csak bejelentkezve működik (a szerkesztő úgyis az).
            <input
              type="file"
              accept="image/*"
              className="mt-2 block text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  onChange((await uploadMedia(file)).url);
                } catch {
                  alert("A kép feltöltése nem sikerült (legfeljebb 8 MB, jpg/png/gif/webp/svg/avif).");
                }
              }}
            />
          )}
        </label>
      );
    case "boolean":
      return (
        <label className="my-3 flex items-center gap-2 font-body text-sm font-medium text-petriksoft">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    case "textarea":
    case "html":
      return (
        <label className="my-3 block font-body text-sm font-medium text-petriksoft">
          {label}
          <textarea
            className={inputCls}
            rows={field.type === "html" ? 8 : 3}
            value={(value as string) ?? ""}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );
    case "number":
      return (
        <label className="my-3 block font-body text-sm font-medium text-petriksoft">
          {label}
          <input
            className={inputCls}
            type="number"
            min={field.min}
            value={(value as number | string) ?? ""}
            required={field.required}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>
      );
    case "select":
      return (
        <label className="my-3 block font-body text-sm font-medium text-petriksoft">
          {label}
          <select
            className={inputCls}
            value={String(value ?? "")}
            required={field.required}
            onChange={(e) => {
              const opt = field.options.find(
                (o) => String(o) === e.target.value,
              );
              onChange(opt ?? "");
            }}
          >
            <option value="">-</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    case "object":
      return (
        <fieldset className="my-3 rounded-lg border border-petrikline bg-petrikcream p-4">
          <legend className="px-2 font-mono text-xs uppercase tracking-wider text-petrikaccentdark">{label}</legend>
          <SchemaForm
            fields={field.fields}
            values={(value as Values) ?? {}}
            onChange={onChange as (v: Values) => void}
          />
        </fieldset>
      );
    case "list": {
      const items = (value as unknown[]) ?? [];
      const set = (next: unknown[]) => onChange(next);
      return (
        <fieldset className="my-3 rounded-lg border border-petrikline bg-petrikcream p-4">
          <legend className="px-2 font-mono text-xs uppercase tracking-wider text-petrikaccentdark">{label}</legend>
          {items.map((item, i) => (
            <div key={i} className="my-3 rounded-lg border border-dashed border-petrikline bg-petrikcard p-3">
              {field.fields === "string" ? (
                <input
                  className={inputCls}
                  type="text"
                  value={(item as string) ?? ""}
                  onChange={(e) =>
                    set(items.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
              ) : (
                <SchemaForm
                  fields={field.fields}
                  values={(item as Values) ?? {}}
                  onChange={(v) => set(items.map((x, j) => (j === i ? v : x)))}
                />
              )}
              <button
                type="button"
                className={btnCls}
                onClick={() => set(items.filter((_, j) => j !== i))}
              >
                Törlés
              </button>
            </div>
          ))}
          <button
            type="button"
            className={btnCls}
            onClick={() =>
              set([
                ...items,
                field.fields === "string" ? "" : emptyValues(field.fields),
              ])
            }
          >
            + Elem hozzáadása
          </button>
        </fieldset>
      );
    }
  }
}

export default function SchemaForm({
  fields,
  values,
  onChange,
}: {
  fields: Fields;
  values: Values;
  onChange: (values: Values) => void;
}) {
  return (
    <>
      {Object.entries(fields).map(([key, field]) => (
        <FieldInput
          key={key}
          field={field}
          value={values[key]}
          onChange={(v) => onChange({ ...values, [key]: v })}
        />
      ))}
    </>
  );
}
