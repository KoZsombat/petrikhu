/**
 * The v1 override layer (AGENTS.md "Server" (/creator)), which AGENTS.md "Core idea: a page is JSON" superseded: a
 * mirrored page used to stay generated code with a `PageOverrides` row laid on
 * top. These types survive only so scripts/migrate-overrides.ts can read the
 * old `page_overrides` rows and turn them into documents.
 */
import type { PageSection } from './page-types.ts'
import type { RichTextDocument } from './types.ts'

export type TextOverride = { content: RichTextDocument }
export type ImageOverride = { src?: string; alt?: string; href?: string }
export type ButtonOverride = { label?: string; to?: string; href?: string }
export type BlurbOverride = { title?: string; content?: RichTextDocument }

export type ModuleOverride = TextOverride | ImageOverride | ButtonOverride | BlurbOverride

/** Keys are `<module-type>:<divi index>`, e.g. `text:12`. */
export type PageOverrides = {
  route: string
  modules: Record<string, ModuleOverride>
  /** Section `index` props. */
  hiddenSections: number[]
  /** Section `index` props in display order; omitted unless the user reordered. */
  sectionOrder?: number[]
  /** Appended below the page. v1 sections: blocks-and-runs content, no indexes. */
  extraSections: PageSection[]
  title?: string
  description?: string
  /** "Rejtés" (hide): the page was served as the 404 page. */
  hidden?: boolean
}
