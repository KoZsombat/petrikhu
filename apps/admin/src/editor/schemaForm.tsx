/**
 * Editing forms generated from the shared zod schemas (packages/shared/src/blocks.ts). A field's label and
 * input come from `.meta({ title, widget })`; the structure (objects, lists, choices, variants) from the
 * schema itself. `defaultFor` builds a new block's values, `clean` drops empty optional fields before saving.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { z } from 'zod'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Widget } from '@petrik/shared/blocks'
import { emptyDoc } from '@petrik/shared/tiptap'
import type { RichDoc } from '@petrik/shared/tiptap'
import { Button, Input, Select, Textarea, cx } from '../ui.tsx'
import { MediaPicker } from './MediaPicker.tsx'
import { RichEditor } from './RichEditor.tsx'

type Any = z.ZodType
type Def = { type: string; innerType?: Any; defaultValue?: unknown; shape?: Record<string, Any>; element?: Any; entries?: Record<string, string>; options?: Any[]; values?: unknown[]; discriminator?: string; in?: Any; out?: Any }

const defOf = (schema: Any): Def => (schema as unknown as { _zod: { def: Def } })._zod.def
const metaOf = (schema: Any): { title?: string; widget?: Widget } => (schema.meta() as { title?: string; widget?: Widget } | undefined) ?? {}

/** Strips optional / default wrappers; the label may sit on the wrapper or the inner schema. */
function unwrap(schema: Any): { inner: Any; optional: boolean; title?: string; widget?: Widget; fallback?: unknown } {
  let inner = schema
  let optional = false
  let fallback: unknown
  let { title, widget } = metaOf(schema)
  for (;;) {
    const def = defOf(inner)
    if (def.type === 'optional' || def.type === 'nullable') optional = true
    else if (def.type === 'default') fallback = typeof def.defaultValue === 'function' ? (def.defaultValue as () => unknown)() : def.defaultValue
    else break
    inner = def.innerType!
    const m = metaOf(inner)
    title ??= m.title
    widget ??= m.widget
  }
  return { inner, optional, title, widget, fallback }
}

const isLiteralUnion = (def: Def) => def.type === 'union' && !def.discriminator && def.options!.every((o) => defOf(o).type === 'literal')

/** The value a new, empty field starts with. */
export function defaultFor(schema: Any): unknown {
  const { inner, optional, widget, fallback } = unwrap(schema)
  if (fallback !== undefined) return fallback
  if (widget === 'richtext') return optional ? undefined : emptyDoc()
  if (optional) return undefined
  const def = defOf(inner)
  switch (def.type) {
    case 'object':
      return Object.fromEntries(Object.entries(def.shape!).map(([k, v]) => [k, defaultFor(v)]).filter(([, v]) => v !== undefined))
    case 'array':
      return []
    case 'boolean':
      return false
    case 'enum':
      return Object.values(def.entries!)[0]
    case 'literal':
      return def.values![0]
    case 'union':
      return isLiteralUnion(def) ? defOf(def.options![0]).values![0] : defaultFor(def.options![0])
    case 'number':
      return undefined
    default:
      return ''
  }
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (typeof value === 'object' && !Array.isArray(value) && Object.values(value as object).every(isEmpty))

/** Drops empty optional strings and objects (an empty optional image, for instance) before saving. */
export function clean(schema: Any, value: unknown): unknown {
  const { inner, optional, widget } = unwrap(schema)
  if (widget === 'richtext') return value
  const def = defOf(inner)
  let out = value
  if (def.type === 'object' && value && typeof value === 'object') {
    out = Object.fromEntries(Object.entries(def.shape!).map(([k, s]) => [k, clean(s, (value as Record<string, unknown>)[k])]).filter(([, v]) => v !== undefined))
  } else if (def.type === 'array' && Array.isArray(value)) out = value.map((item) => clean(def.element!, item))
  else if (def.type === 'union' && def.discriminator && value && typeof value === 'object') {
    const option = def.options!.find((o) => defOf(defOf(o).shape![def.discriminator!]).values?.[0] === (value as Record<string, unknown>)[def.discriminator!])
    out = option ? clean(option, value) : value
  } else if (typeof value === 'string') out = value.trim()
  return optional && isEmpty(out) ? undefined : out
}

const CHOICE_LABELS: Record<string, string> = { left: 'Balra', right: 'Jobbra', info: 'Halvány kiemelés', accent: 'Zöld háttér', highlight: 'Keskeny sáv (felülcímmel)', text: 'Szöveges kártyák', person: 'Személyek', stat: 'Számok', fact: 'Adatsorok', step: 'Lépések' }

function FieldLabel({ title, children, inline }: { title?: string; children: ReactNode; inline?: boolean }) {
  return (
    <label className={cx('block', inline && 'flex items-center gap-2')}>
      {!inline && title && <span className="mb-1 block text-sm font-medium">{title}</span>}
      {children}
      {inline && title && <span className="text-sm">{title}</span>}
    </label>
  )
}

function ImageField({ value, onChange, title }: { value: string; onChange: (v: string) => void; title?: string }) {
  const [picking, setPicking] = useState(false)
  return (
    <FieldLabel title={title}>
      <div className="flex items-center gap-2">
        {value && <img src={/^\/(uploads|media)\/.+\.(jpe?g|png|webp|avif)$/i.test(value) ? `${value}?w=480&f=webp` : value} alt="" className="size-10 rounded object-cover" />}
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… vagy https://…" />
        <Button onClick={() => setPicking(true)}>Választás</Button>
      </div>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(url) => {
            onChange(url)
            setPicking(false)
          }}
        />
      )}
    </FieldLabel>
  )
}

/** One field of any shape. */
export function Field({ schema, value, onChange }: { schema: Any; value: unknown; onChange: (value: unknown) => void }) {
  const { inner, title, widget, optional } = unwrap(schema)
  const def = defOf(inner)
  const label = title ? `${title}${optional ? '' : ' *'}` : undefined

  if (widget === 'richtext') {
    return (
      <div>
        {label && <span className="mb-1 block text-sm font-medium">{label}</span>}
        <RichEditor value={(value as RichDoc | undefined) ?? emptyDoc()} onChange={onChange} label={title} />
      </div>
    )
  }
  if (widget === 'image') return <ImageField value={(value as string) ?? ''} onChange={onChange} title={label} />

  switch (def.type) {
    case 'string':
      return (
        <FieldLabel title={label}>
          {widget === 'textarea' ? (
            <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} type={widget === 'url' ? 'text' : 'text'} placeholder={widget === 'url' ? '/oldal vagy https://…' : undefined} />
          )}
        </FieldLabel>
      )
    case 'number':
      return (
        <FieldLabel title={label}>
          <Input type="number" value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="max-w-40" />
        </FieldLabel>
      )
    case 'boolean':
      return (
        <FieldLabel title={label} inline>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        </FieldLabel>
      )
    case 'enum':
    case 'union':
      if (def.type === 'enum' || isLiteralUnion(def)) {
        const options = def.type === 'enum' ? Object.values(def.entries!) : def.options!.map((o) => defOf(o).values![0])
        return (
          <FieldLabel title={label}>
            <Select value={String(value ?? '')} onChange={(e) => onChange(typeof options[0] === 'number' ? Number(e.target.value) : e.target.value)} className="max-w-60">
              {options.map((option) => (
                <option key={String(option)} value={String(option)}>
                  {CHOICE_LABELS[String(option)] ?? String(option)}
                </option>
              ))}
            </Select>
          </FieldLabel>
        )
      }
      return <VariantFields schema={inner} value={value as Record<string, unknown>} onChange={onChange} />
    case 'literal':
      return null
    case 'object':
      return (
        <fieldset className="space-y-3 rounded-md border border-petriklinesoft p-3">
          {label && <legend className="px-1 text-sm font-medium">{label}</legend>}
          <ObjectFields schema={inner} value={(value as Record<string, unknown>) ?? {}} onChange={onChange} />
        </fieldset>
      )
    case 'array':
      return <ListField title={label} element={def.element!} value={(value as unknown[]) ?? []} onChange={onChange} />
    default:
      return <p className="text-xs text-red-700">Nem szerkeszthető mező: {title}</p>
  }
}

export function ObjectFields({ schema, value, onChange, skip }: { schema: Any; value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; skip?: string }) {
  const shape = defOf(schema).shape!
  return (
    <>
      {Object.entries(shape)
        .filter(([key]) => key !== skip)
        .map(([key, fieldSchema]) => (
          <Field key={key} schema={fieldSchema} value={value[key]} onChange={(v) => onChange({ ...value, [key]: v })} />
        ))}
    </>
  )
}

/** A discriminated union (a block with variants): pick the variant, then its fields. */
function VariantFields({ schema, value, onChange }: { schema: Any; value: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const def = defOf(schema)
  const key = def.discriminator!
  const variantOf = (option: Any) => defOf(defOf(option).shape![key]).values![0] as string
  const option = def.options!.find((o) => variantOf(o) === value?.[key]) ?? def.options![0]
  return (
    <div className="space-y-3">
      <FieldLabel title="Változat">
        <Select
          value={variantOf(option)}
          onChange={(e) => {
            const next = def.options!.find((o) => variantOf(o) === e.target.value)!
            // Keep what fits the new variant (heading, items…), add the rest from the defaults.
            onChange({ ...(defaultFor(next) as object), ...Object.fromEntries(Object.entries(value ?? {}).filter(([k]) => k !== key && k in defOf(next).shape!)), [key]: e.target.value })
          }}
          className="max-w-60"
        >
          {def.options!.map((o) => (
            <option key={variantOf(o)} value={variantOf(o)}>
              {metaOf(defOf(o).shape![key]).title ?? CHOICE_LABELS[variantOf(o)] ?? variantOf(o)}
            </option>
          ))}
        </Select>
      </FieldLabel>
      <ObjectFields schema={option} value={value ?? {}} onChange={onChange} skip={key} />
    </div>
  )
}

function ListField({ title, element, value, onChange }: { title?: string; element: Any; value: unknown[]; onChange: (value: unknown[]) => void }) {
  const move = (from: number, to: number) => {
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  const simple = defOf(unwrap(element).inner).type === 'string'
  return (
    <div>
      {title && <span className="mb-1 block text-sm font-medium">{title}</span>}
      <ol className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className={cx('flex gap-2', !simple && 'rounded-md border border-petriklinesoft bg-petrikcream/50 p-3')}>
            <div className="min-w-0 flex-1 space-y-3">
              {simple ? (
                <Input value={(item as string) ?? ''} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`${title ?? 'Elem'} ${i + 1}`} />
              ) : (
                <Field schema={element} value={item} onChange={(v) => onChange(value.map((old, j) => (j === i ? v : old)))} />
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button tone="ghost" aria-label="Fel" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp size={14} />
              </Button>
              <Button tone="ghost" aria-label="Le" disabled={i === value.length - 1} onClick={() => move(i, i + 1)}>
                <ArrowDown size={14} />
              </Button>
              <Button tone="ghost" aria-label="Törlés" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-2" onClick={() => onChange([...value, defaultFor(element) ?? ''])}>
        <Plus size={14} /> Új elem
      </Button>
    </div>
  )
}
