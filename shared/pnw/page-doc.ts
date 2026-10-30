/**
 * Pure helpers over a PageDocument (AGENTS.md "Core idea: a page is JSON"): walking it, numbering its
 * nodes and bringing a document saved by the v1 builder up to the v2 shape.
 * No React - the renderer, the editor, the server and the scripts share it.
 */
import { toRichContent } from './rich-content.ts'
import type { PageColumn, PageDocument, PageModule, PageModuleKind, PageRow, PageSection } from './page-types.ts'

/** Everything Divi numbers separately on a page (et_pb_section_0, et_pb_text_0, …). */
export type IndexKey = 'section' | 'row' | 'column' | PageModuleKind

/** Every module of a document, in document order (sections' fullwidth modules, then rows, then the docs frame's body). */
export function documentModules(document: PageDocument): PageModule[] {
  const out: PageModule[] = []
  for (const section of document.sections) {
    if (section.modules) out.push(...section.modules)
    for (const row of section.rows) for (const column of row.columns) out.push(...column.modules)
  }
  if (document.body) out.push(...document.body)
  return out
}

/** The next free Divi number for a kind of node: one above the highest in use, so it never collides with a stylesheet rule meant for another node. */
export function nextIndex(document: PageDocument, key: IndexKey): number {
  let max = -1
  const see = (index: number | undefined) => {
    if (index !== undefined && index > max) max = index
  }
  if (key === 'section') document.sections.forEach((section) => see(section.index))
  else if (key === 'row') document.sections.forEach((section) => section.rows.forEach((row) => see(row.index)))
  else if (key === 'column') {
    document.sections.forEach((section) => section.rows.forEach((row) => row.columns.forEach((column) => see(column.index))))
  } else {
    documentModules(document).forEach((module) => {
      if (module.kind === key) see(module.index)
    })
  }
  return max + 1
}

type Plain = Record<string, unknown>

const isObject = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Joins class tokens without duplicates. */
function addClass(className: unknown, token: string): string {
  const tokens = typeof className === 'string' ? className.split(/\s+/).filter(Boolean) : []
  if (!tokens.includes(token)) tokens.push(token)
  return tokens.join(' ')
}

const CONTENT_KINDS = new Set(['text', 'blurb', 'toggle', 'testimonial', 'team-member'])

/**
 * Brings anything a document column may hold up to the current model:
 * blocks-and-runs content becomes a content tree, the v1 column `bordered`
 * flag becomes its `et_pb_with_border` class, and every node without a Divi
 * `index` gets one (one above the highest of its kind, in document order - so
 * a v1 document, which numbered everything from 0 at render time, keeps
 * exactly the numbers it rendered with).
 *
 * Idempotent, and tolerant: it never throws on a shape it does not know -
 * the server's validator is what rejects those.
 */
export function normalizeDocument(raw: PageDocument): PageDocument {
  const document = raw as PageDocument

  const fixModule = (module: PageModule): PageModule => {
    const next = { ...module } as Plain
    if (CONTENT_KINDS.has(module.kind) && next.content !== undefined) next.content = toRichContent(next.content)
    return next as PageModule
  }

  const sections: PageSection[] = (document.sections ?? []).map((section) => {
    const next = { ...section } as Plain
    if (Array.isArray(section.modules)) next.modules = section.modules.map(fixModule)
    next.rows = (section.rows ?? []).map((row): PageRow => {
      const nextRow = { ...row } as Plain
      nextRow.columns = (row.columns ?? []).map((column): PageColumn => {
        const nextColumn = { ...column } as Plain
        if (isObject(column) && (column as Plain).bordered === true) {
          nextColumn.className = addClass(nextColumn.className, 'et_pb_with_border')
        }
        delete nextColumn.bordered
        nextColumn.modules = (column.modules ?? []).map(fixModule)
        return nextColumn as PageColumn
      })
      return nextRow as PageRow
    })
    return next as PageSection
  })

  const result: PageDocument = { ...document, sections }
  if (Array.isArray(document.body)) result.body = document.body.map(fixModule)
  if (document.content !== undefined) result.content = toRichContent(document.content)

  // Number what has no number yet.
  const counters = new Map<IndexKey, number>()
  const take = (key: IndexKey): number => {
    const next = counters.get(key) ?? nextIndex(result, key)
    counters.set(key, next + 1)
    return next
  }
  for (const section of result.sections) {
    if (section.index === undefined) section.index = take('section')
    for (const module of section.modules ?? []) if (module.index === undefined) module.index = take(module.kind)
    for (const row of section.rows) {
      if (row.index === undefined) row.index = take('row')
      for (const column of row.columns) {
        if (column.index === undefined) column.index = take('column')
        for (const module of column.modules) if (module.index === undefined) module.index = take(module.kind)
      }
    }
  }
  for (const module of result.body ?? []) if (module.index === undefined) module.index = take(module.kind)
  return result
}
