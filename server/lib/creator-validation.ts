/**
 * Field-level validation of Creator page blocks against the shared schema (shared/pnw/creator-schema.ts),
 * built with zod. The client draws its form from the same schema, so whatever the form can save passes here -
 * but a hand-crafted request can no longer store an unknown component, an unknown field or a wrong type.
 *
 * The form sends every field, empty ones as '' / [] / an empty object (emptyValue in creator-schema.ts), so an
 * empty optional value counts as "not given", even when the object has required sub-fields (an unused cover).
 */
import { z } from 'zod'
import { COMPONENTS } from '../../shared/pnw/creator-schema.ts'
import type { Field, Fields } from '../../shared/pnw/creator-schema.ts'
import { isSafeHref } from '../../shared/pnw/richtext.ts'

const MAX_TEXT = 2_000
const MAX_HTML = 200_000
const MAX_ITEMS = 500

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEmpty)
  return false
}

/** The schema of a field's value, without the required/optional handling. */
function valueSchema(field: Field): z.ZodType {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return z.string().max(MAX_TEXT)
    case 'html':
      return z.string().max(MAX_HTML)
    case 'image':
      return z.string().max(MAX_TEXT).refine((src) => isSafeHref(src), 'unsafe image URL')
    case 'url':
      return z.string().max(MAX_TEXT).refine((href) => href.startsWith('#') || isSafeHref(href), 'unsafe link')
    case 'number':
      return z.number().finite().min(field.min ?? -Infinity)
    case 'boolean':
      return z.boolean()
    case 'select':
      return z.union(field.options.map((option) => z.literal(option)) as [z.ZodLiteral, z.ZodLiteral, ...z.ZodLiteral[]])
    case 'list':
      return z.array(field.fields === 'string' ? z.string().max(MAX_TEXT) : objectSchema(field.fields)).max(MAX_ITEMS)
    case 'object':
      return objectSchema(field.fields)
  }
}

function fieldSchema(field: Field): z.ZodType {
  const schema = valueSchema(field)
  // A required text may not be empty or whitespace only.
  if (field.required) return schema.refine((value) => typeof value !== 'string' || value.trim() !== '', 'required')
  return z.preprocess((value) => (isEmpty(value) ? undefined : value), schema.optional())
}

/** Strict: a key that is not in the schema is an error, it cannot end up in a page. */
function objectSchema(fields: Fields): z.ZodType {
  return z.strictObject(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, fieldSchema(field)])))
}

const cache = new Map<string, z.ZodType>()

function blockSchema(component: string, variant: string | undefined): z.ZodType | string {
  const definition = COMPONENTS[component]
  if (!definition) return `unknown component: ${component}`
  const fields = definition.variants ? (variant ? definition.variants[variant] : undefined) : definition.fields
  if (!fields) return definition.variants ? `unknown variant: ${component}/${variant ?? '(none)'}` : `${component}: no field schema`
  const key = `${component}/${variant ?? ''}`
  let schema = cache.get(key)
  if (!schema) {
    schema = objectSchema(fields)
    cache.set(key, schema)
  }
  return schema
}

export type BlockIssue = { block: number; path: string; message: string }

/** Field problems of the blocks (empty list: all good). The caller has already checked the block shape (component, values). */
export function validateBlockFields(blocks: { component: string; variant?: string; values: Record<string, unknown> }[]): BlockIssue[] {
  const issues: BlockIssue[] = []
  blocks.forEach((block, index) => {
    const schema = blockSchema(block.component, block.variant)
    if (typeof schema === 'string') {
      issues.push({ block: index, path: '', message: schema })
      return
    }
    const result = schema.safeParse(block.values)
    if (!result.success) {
      for (const issue of result.error.issues.slice(0, 10)) {
        issues.push({ block: index, path: issue.path.join('.'), message: issue.message })
      }
    }
  })
  return issues
}
