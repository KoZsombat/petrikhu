import type { Align, BlockType, RichStyle, RichTextBlock, RichTextDocument, TextRun } from '../../shared/pnw/types.ts'
import { RICH_STYLE_KEYS, isEmbedSrc } from '../../shared/pnw/types.ts'
import { isMediaBlock } from '../../shared/pnw/richtext.ts'
import { COLUMN_SPANS, DESIGN_NUMBER_LIMITS, MODULE_ANIMATIONS, MODULE_KINDS, PAGE_TEMPLATES } from '../../shared/pnw/page-types.ts'
import type {
  Design,
  DocLibrary,
  FeedItem,
  ModuleAnimation,
  MenuNode,
  PageColumn,
  PageDocument,
  PageImage,
  PageModule,
  PageRow,
  PageSection,
  SiteMenu,
  TextAlign,
} from '../../shared/pnw/page-types.ts'
import { isLegacyBlocks, isValidStyleValue, blocksToRich, RICH_TAGS } from '../../shared/pnw/rich-content.ts'
import type { RichContent, RichElement, RichNode, RichTag } from '../../shared/pnw/rich-content.ts'
import { normalizeDocument } from '../../shared/pnw/page-doc.ts'
import { isSafeColor, isSafeHref } from '../../shared/pnw/richtext.ts'

/** Mirrors the save_news/reviewer_save check on wp_strip_all_tags(content). */
export function hasRealText(content: RichTextDocument): boolean {
  return content.some(
    (block) =>
      isMediaBlock(block) ||
      block.runs.some((run) => run.text.trim() !== '') ||
      (block.table?.rows ?? []).some((row) => row.some((cell) => cell.trim() !== '')),
  )
}

/** A picture in a post: an upload/in-app path or an http(s) URL - never `javascript:` or `data:`. */
function isPostImageSrc(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  return (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\//i.test(value)
}

const optText = (value: unknown, max = 2000): string | undefined =>
  typeof value === 'string' && value !== '' ? value.slice(0, max) : undefined

const optMediaSize = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000 ? value : undefined

/**
 * Rebuilds a media block's own field from scratch (AGENT.md 6.24) - unknown
 * keys dropped, every URL checked - or returns null to reject the document.
 */
function sanitizeMedia(block: Record<string, unknown>): Partial<RichTextBlock> | null {
  if (block.type === 'image') {
    const image = block.image as Record<string, unknown> | undefined
    if (!image || !isPostImageSrc(image.src)) return null
    const href = optText(image.href)
    if (href !== undefined && !isSafeHref(href)) return null
    return {
      image: {
        src: image.src,
        alt: optText(image.alt, MAX_LABEL) ?? '',
        caption: optText(image.caption),
        href,
        width: optMediaSize(image.width),
        height: optMediaSize(image.height),
      },
    }
  }
  if (block.type === 'gallery') {
    const items = block.gallery
    if (!Array.isArray(items) || items.length === 0 || items.length > 300) return null
    const gallery = []
    for (const item of items as Record<string, unknown>[]) {
      if (typeof item !== 'object' || item === null || !isPostImageSrc(item.src)) return null
      if (item.full !== undefined && !isPostImageSrc(item.full)) return null
      gallery.push({ src: item.src, alt: optText(item.alt, MAX_LABEL) ?? '', full: item.full as string | undefined })
    }
    return { gallery }
  }
  if (block.type === 'embed') {
    const embed = block.embed as Record<string, unknown> | undefined
    if (!embed || typeof embed.src !== 'string' || !isEmbedSrc(embed.src)) return null
    return {
      embed: {
        src: embed.src,
        title: optText(embed.title, MAX_LABEL),
        aspect: typeof embed.aspect === 'number' && embed.aspect > 0 && embed.aspect < 10 ? embed.aspect : undefined,
        height: optMediaSize(embed.height),
      },
    }
  }
  return {}
}

/**
 * Keeps only ids that really exist as terms of the right kind. There is no
 * per-account allow-list any more - every account may use every category and
 * tag (AGENT.md 6.16) - so the only thing left to check is existence, which
 * the caller reads fresh from the terms table (a term created a second ago
 * has to be usable immediately).
 */
export function sanitizeTermIds(ids: unknown, known: Set<string>): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  return ids.filter((id): id is string => {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** Form fields arrive as JSON strings (FormData), JSON bodies as real arrays. */
export function parseIdList(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function parseRichText(raw: unknown): RichTextDocument | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    // A table's cells are rendered as text, but their shape must be what the renderer indexes into.
    for (const block of parsed) {
      if (typeof block !== 'object' || block === null) return null
      if (block.type === 'table') {
        const rows = block.table?.rows
        if (!Array.isArray(rows) || rows.length > 100) return null
        for (const row of rows) {
          if (!Array.isArray(row) || row.length > 30 || row.some((cell: unknown) => typeof cell !== 'string' || cell.length > 2000)) return null
        }
      }
      // Media blocks (AGENT.md 6.24) carry URLs the renderer puts into src/href attributes.
      const media = sanitizeMedia(block)
      if (!media) return null
      delete block.image
      delete block.gallery
      delete block.embed
      Object.assign(block, clean(media as Plain))
      for (const field of ['image', 'embed'] as const) if (block[field]) clean(block[field])
    }
    return parsed as RichTextDocument
  } catch {
    return null
  }
}

/* --- the Szerkesztő (AGENT.md 6.20) ---------------------------------------
 *
 * Everything below rebuilds the value from scratch rather than passing the
 * parsed JSON through: unknown keys are dropped, unknown module kinds and
 * non-string content reject the whole document, and every link/colour/image/
 * style goes through the same allow-list the renderer uses. The JSON columns
 * must never round-trip an untrusted shape into the public renderer.
 */

type Plain = Record<string, unknown>

const isObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const MAX_TEXT = 20_000
const MAX_LABEL = 300
const MAX_ITEMS = 1000
/** A hard ceiling on the nodes of one document, so a hostile body cannot be a memory bomb. */
const MAX_NODES = 60_000
const MAX_DEPTH = 24

class Invalid extends Error {}

function fail(what: string): never {
  throw new Invalid(what)
}

/** Counts every node a document builds; one document may hold at most MAX_NODES. */
let budget = 0
function spend(count = 1): void {
  budget += count
  if (budget > MAX_NODES) fail('document too large')
}

function str(value: unknown, max = MAX_LABEL, what = 'string'): string {
  if (typeof value !== 'string' || value.length > max) fail(what)
  return value
}

function optStr(value: unknown, max = MAX_LABEL): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return str(value, max)
}

function list(value: unknown, what: string, max = MAX_ITEMS): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(what)
  spend(value.length)
  return value
}

function nodeId(value: unknown): string {
  const text = str(value, 64, 'id')
  if (!/^[A-Za-z0-9_-]+$/.test(text)) fail('id')
  return text
}

/** A link target: an in-app route or an http(s)/mailto/tel URL - see isSafeHref(). */
function optHref(value: unknown): string | undefined {
  const text = optStr(value, 2000)
  if (text === undefined) return undefined
  if (!isSafeHref(text)) fail('href')
  return text
}

/** An image: a root-relative path (`/media/...`, `/uploads/...`) or an http(s) URL. */
function imageSrc(value: unknown): string {
  const text = str(value, 2000, 'src')
  const rootRelative = text.startsWith('/') && !text.startsWith('//')
  if (!rootRelative && !/^https?:\/\//i.test(text)) fail('src')
  return text
}

function optColor(value: unknown): string | undefined {
  const text = optStr(value, 64)
  if (text === undefined) return undefined
  if (!isSafeColor(text)) fail('color')
  return text
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], what: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) fail(what)
  return value as T
}

function optOneOf<T extends string>(value: unknown, allowed: readonly T[], what: string): T | undefined {
  return value === undefined || value === null ? undefined : oneOf(value, allowed, what)
}

function optInt(value: unknown, min: number, max: number, what: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) fail(what)
  return value
}

function optBool(value: unknown): true | undefined {
  return value === true ? true : undefined
}

/** Drops keys whose value is undefined, so the stored JSON never carries them. */
function clean<T extends Plain>(value: T): T {
  for (const key of Object.keys(value)) if (value[key] === undefined) delete value[key]
  return value
}

const BLOCK_TYPES: readonly BlockType[] = [
  'paragraph',
  'heading',
  'bulleted-list',
  'numbered-list',
  'blockquote',
  'div',
  'plain',
]
const BLOCK_ALIGNS = ['left', 'center', 'right', 'justify'] as const
const ALIGNS: readonly Align[] = ['left', 'center', 'right']
const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'center', 'right', 'justified']

/* -- text -------------------------------------------------------------------- */

function richStyle(value: unknown): RichStyle | undefined {
  if (value === undefined || value === null) return undefined
  if (!isObject(value)) fail('style')
  const style: RichStyle = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!(RICH_STYLE_KEYS as readonly string[]).includes(key)) fail('style key')
    const text = str(raw, 200, 'style value')
    if (!isValidStyleValue(key as keyof RichStyle, text)) fail('style value')
    style[key as keyof RichStyle] = text
  }
  return Object.keys(style).length ? style : undefined
}

function richNode(raw: unknown, depth: number): RichNode {
  if (typeof raw === 'string') {
    spend()
    return str(raw, MAX_TEXT, 'text')
  }
  if (!isObject(raw) || depth > MAX_DEPTH) fail('node')
  spend()
  const tag = oneOf(raw.tag, RICH_TAGS as readonly RichTag[], 'tag')
  const node: RichElement = { tag }
  const style = richStyle(raw.style)
  if (style) node.style = style
  if (tag === 'a') {
    const href = optHref(raw.href)
    if (!href) fail('link without href')
    node.href = href
  }
  if (raw.children !== undefined && raw.children !== null) {
    if (tag === 'br') fail('br with children')
    const children = list(raw.children, 'children', 2000).map((child) => richNode(child, depth + 1))
    if (children.length) node.children = children
  }
  return node
}

/** The v1 builder stored blocks-and-runs; those are still accepted and converted. */
function legacyRichText(value: unknown): RichTextDocument {
  return list(value, 'content').map((raw) => {
    if (!isObject(raw)) fail('block')
    const block: RichTextBlock = {
      id: nodeId(raw.id),
      type: oneOf(raw.type, BLOCK_TYPES, 'block type'),
      runs: list(raw.runs, 'runs').map((rawRun) => {
        if (!isObject(rawRun)) fail('run')
        const run: TextRun = { text: str(rawRun.text, MAX_TEXT, 'text') }
        if (rawRun.bold === true) run.bold = true
        if (rawRun.italic === true) run.italic = true
        if (rawRun.underline === true) run.underline = true
        const color = optColor(rawRun.color)
        if (color) run.color = color
        const href = optHref(rawRun.href)
        if (href) run.href = href
        const style = richStyle(rawRun.style)
        if (style) run.style = style
        return run
      }),
    }
    const align = optOneOf(raw.align, BLOCK_ALIGNS, 'align')
    if (align) block.align = align
    if (raw.level !== undefined && raw.level !== null) {
      block.level = optInt(raw.level, 1, 6, 'level') as RichTextBlock['level']
    }
    const depth = optInt(raw.depth, 0, 8, 'depth')
    if (depth) block.depth = depth
    const style = richStyle(raw.style)
    if (style) block.style = style
    return block
  })
}

function richContent(value: unknown): RichContent {
  if (!Array.isArray(value)) fail('content')
  if (isLegacyBlocks(value)) return blocksToRich(legacyRichText(value))
  return list(value, 'content', 2000).map((raw) => richNode(raw, 0))
}

/* -- design ------------------------------------------------------------------ */

function design(value: unknown): Design | undefined {
  if (value === undefined || value === null) return undefined
  if (!isObject(value)) fail('design')
  const out: Design = {}
  const color = optColor(value.color)
  if (color) out.color = color
  const background = optColor(value.background)
  if (background) out.background = background
  const borderColor = optColor(value.borderColor)
  if (borderColor) out.borderColor = borderColor
  for (const key of Object.keys(DESIGN_NUMBER_LIMITS) as (keyof typeof DESIGN_NUMBER_LIMITS)[]) {
    const [min, max] = DESIGN_NUMBER_LIMITS[key]
    const number = optInt(value[key], min, max, key)
    if (number !== undefined) out[key] = number
  }
  const textAlign = optOneOf(value.textAlign, BLOCK_ALIGNS, 'textAlign')
  if (textAlign) out.textAlign = textAlign
  return Object.keys(out).length ? out : undefined
}

/* -- modules ----------------------------------------------------------------- */

function optDimension(value: unknown): number | undefined {
  return optInt(value, 1, 10_000, 'dimension')
}

/** A button's `to` is an in-app route only; an external target goes in `href`. */
function optRoute(value: unknown): string | undefined {
  const to = optHref(value)
  if (to && !to.startsWith('/')) fail('route')
  return to
}

const CLASS_NAME = /^[A-Za-z0-9_ -]{1,200}$/

function optClass(value: unknown): string | undefined {
  const text = optStr(value, 200)
  if (text === undefined) return undefined
  if (!CLASS_NAME.test(text)) fail('className')
  return text
}

/** Every node's common fields: id, Divi index, extra classes, design. */
function base(raw: Plain): { id: string; index?: number; className?: string; design?: Design; animation?: ModuleAnimation } {
  return clean({
    id: nodeId(raw.id),
    index: optInt(raw.index, 0, 9999, 'index'),
    className: optClass(raw.className),
    design: design(raw.design),
    animation: optOneOf(raw.animation, MODULE_ANIMATIONS, 'animation'),
  })
}

function pageImage(value: unknown): PageImage {
  if (!isObject(value)) fail('image')
  return clean({
    src: imageSrc(value.src),
    alt: optStr(value.alt),
    width: optDimension(value.width),
    height: optDimension(value.height),
    srcSet: optStr(value.srcSet, 4000),
    sizes: optStr(value.sizes, 1000),
    loading: optOneOf(value.loading, ['lazy', 'eager'] as const, 'loading'),
  })
}

function optImage(value: unknown): PageImage | undefined {
  return value === undefined || value === null ? undefined : pageImage(value)
}

function objects(value: unknown, what: string): Plain[] {
  return list(value, what).map((item) => {
    if (!isObject(item)) fail(what)
    return item
  })
}

function feedItems(value: unknown): FeedItem[] {
  return objects(value, 'feed items').map((item) => {
    const author = isObject(item.author) ? item.author : undefined
    if (item.author !== undefined && item.author !== null && !author) fail('author')
    return clean({
      slug: str(item.slug, 200, 'slug'),
      date: optStr(item.date, 60),
      author: author ? { name: str(author.name), to: str(author.to, 2000, 'to') } : undefined,
    })
  })
}

function pageModule(raw: unknown): PageModule {
  if (!isObject(raw)) fail('module')
  spend()
  const common = base(raw)
  const kind = oneOf(raw.kind, MODULE_KINDS, 'module kind')

  switch (kind) {
    case 'text':
      return clean({
        kind,
        ...common,
        align: optOneOf(raw.align, TEXT_ALIGNS, 'align'),
        bgLayout: optOneOf(raw.bgLayout, ['light', 'dark'] as const, 'bgLayout'),
        content: richContent(raw.content),
      }) as PageModule
    case 'image':
      return clean({ kind, ...common, ...pageImage(raw), href: optHref(raw.href) }) as PageModule
    case 'button':
      return clean({
        kind,
        ...common,
        label: str(raw.label, MAX_LABEL, 'label'),
        to: optRoute(raw.to),
        href: optHref(raw.href),
        align: optOneOf(raw.align, ALIGNS, 'align'),
        icon: optStr(raw.icon, 8),
      }) as PageModule
    case 'blurb':
      return clean({
        kind,
        ...common,
        title: optStr(raw.title),
        titleHref: optHref(raw.titleHref),
        iconHref: optHref(raw.iconHref),
        image: optImage(raw.image),
        icon: optStr(raw.icon, 8),
        position: optOneOf(raw.position, ['top', 'left', 'right'] as const, 'position'),
        align: optOneOf(raw.align, TEXT_ALIGNS, 'align'),
        content: richContent(raw.content ?? []),
      }) as PageModule
    case 'divider':
      return { kind, ...common } as PageModule
    case 'video': {
      // Empty while the author has not pasted a link yet - it then renders nothing.
      const url = str(raw.url, 2000, 'url')
      if (url && !/^https?:\/\//i.test(url)) fail('url')
      return clean({ kind, ...common, url, title: optStr(raw.title) }) as PageModule
    }
    case 'toggle':
      return clean({
        kind,
        ...common,
        title: str(raw.title, MAX_LABEL, 'title'),
        defaultOpen: optBool(raw.defaultOpen),
        content: richContent(raw.content),
      }) as PageModule
    case 'post-feed':
      return clean({
        kind,
        ...common,
        items: feedItems(raw.items),
        olderPages: raw.olderPages === undefined ? undefined : list(raw.olderPages, 'feed pages').map(feedItems),
        columns: optInt(raw.columns, 1, 3, 'columns') as 1 | 2 | 3 | undefined,
        align: optOneOf(raw.align, ALIGNS, 'align'),
        hasOlder: optBool(raw.hasOlder),
        includeLive: optBool(raw.includeLive),
      }) as PageModule
    case 'team-member':
      return clean({
        kind,
        ...common,
        name: str(raw.name, MAX_LABEL, 'name'),
        position: optStr(raw.position),
        image: optImage(raw.image),
        headingLevel: optInt(raw.headingLevel, 1, 6, 'headingLevel') as 4 | 6 | undefined,
        align: optOneOf(raw.align, ALIGNS, 'align'),
        content: raw.content === undefined || raw.content === null ? undefined : richContent(raw.content),
      }) as PageModule
    case 'social-follow':
      return clean({
        kind,
        ...common,
        networks: objects(raw.networks, 'networks').map((item) => ({
          network: str(item.network, 60, 'network'),
          href: str(item.href, 2000, 'href'),
          title: str(item.title, MAX_LABEL, 'title'),
          label: str(item.label, MAX_LABEL, 'label'),
        })),
        align: optOneOf(raw.align, ALIGNS, 'align'),
      }) as PageModule
    case 'number-counter':
      if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) fail('value')
      return clean({
        kind,
        ...common,
        value: raw.value,
        title: str(raw.title, MAX_LABEL, 'title'),
        suffix: optStr(raw.suffix, 20),
      }) as PageModule
    case 'testimonial':
      return clean({
        kind,
        ...common,
        author: str(raw.author, MAX_LABEL, 'author'),
        portrait: raw.portrait === undefined || raw.portrait === null || raw.portrait === '' ? undefined : imageSrc(raw.portrait),
        align: optOneOf(raw.align, TEXT_ALIGNS, 'align'),
        content: richContent(raw.content),
      }) as PageModule
    case 'pricing-tables':
      return clean({
        kind,
        ...common,
        tables: objects(raw.tables, 'tables').map((table) =>
          clean({
            title: str(table.title, MAX_LABEL, 'title'),
            sum: optStr(table.sum),
            items: list(table.items, 'items').map((item) => str(item, MAX_LABEL, 'item')),
          }),
        ),
      }) as PageModule
    case 'hero-slider':
      return clean({
        kind,
        ...common,
        slides: objects(raw.slides, 'slides').map((slide) =>
          clean({ image: imageSrc(slide.image), heading: optStr(slide.heading), text: optStr(slide.text, 2000) }),
        ),
        intervalMs: optInt(raw.intervalMs, 0, 120_000, 'intervalMs'),
        headerOffset: optStr(raw.headerOffset, 20),
      }) as PageModule
    case 'gallery':
      return clean({
        kind,
        ...common,
        items: objects(raw.items, 'gallery items').map((item) =>
          clean({ ...pageImage(item), full: item.full === undefined || item.full === null ? undefined : imageSrc(item.full) }),
        ),
        perPage: optInt(raw.perPage, 1, 100, 'perPage'),
      }) as PageModule
    case 'fullwidth-header':
      return clean({
        kind,
        ...common,
        heading: str(raw.heading, MAX_LABEL, 'heading'),
        text: optStr(raw.text, 2000),
        buttons:
          raw.buttons === undefined || raw.buttons === null
            ? undefined
            : objects(raw.buttons, 'buttons').map((button) =>
                clean({ label: str(button.label), to: optRoute(button.to), href: optHref(button.href) }),
              ),
        align: optOneOf(raw.align, ALIGNS, 'align'),
      }) as PageModule
    case 'file-block':
      return clean({
        kind,
        ...common,
        embed: imageSrc(raw.embed),
        href: imageSrc(raw.href),
        label: str(raw.label, MAX_LABEL, 'label'),
        buttonLabel: str(raw.buttonLabel, MAX_LABEL, 'buttonLabel'),
        embedLabel: str(raw.embedLabel, MAX_LABEL, 'embedLabel'),
      }) as PageModule
  }
}

function pageColumn(raw: unknown): PageColumn {
  if (!isObject(raw)) fail('column')
  spend()
  return clean({
    ...base(raw),
    span: oneOf(raw.span, COLUMN_SPANS, 'span'),
    last: typeof raw.last === 'boolean' ? raw.last : undefined,
    modules: list(raw.modules, 'modules').map(pageModule),
  }) as PageColumn
}

function pageRow(raw: unknown): PageRow {
  if (!isObject(raw)) fail('row')
  spend()
  const row = clean({
    ...base(raw),
    gutters: raw.gutters === 2 || raw.gutters === 3 || raw.gutters === 4 ? raw.gutters : undefined,
    equalColumns: optBool(raw.equalColumns),
    columns: list(raw.columns, 'columns', 12).map(pageColumn),
  }) as PageRow
  return row
}

function pageSection(raw: unknown): PageSection {
  if (!isObject(raw)) fail('section')
  spend()
  const section = clean({
    ...base(raw),
    first: optBool(raw.first),
    dividerTop: optBool(raw.dividerTop),
    dividerBottom: optBool(raw.dividerBottom),
    withBackground: optBool(raw.withBackground),
    fullwidth: optBool(raw.fullwidth),
    rows: list(raw.rows ?? [], 'rows').map(pageRow),
    modules: raw.modules === undefined || raw.modules === null ? undefined : list(raw.modules, 'modules').map(pageModule),
  }) as PageSection
  if (raw.background !== undefined && raw.background !== null) {
    if (!isObject(raw.background)) fail('background')
    const color = optColor(raw.background.color)
    const rawImage = raw.background.image
    const image = rawImage === undefined || rawImage === null || rawImage === '' ? undefined : imageSrc(rawImage)
    if (color || image) section.background = clean({ color, image })
  }
  return section
}

function attempt<T>(build: () => T): T | null {
  budget = 0
  try {
    return build()
  } catch (error) {
    if (error instanceof Invalid) return null
    throw error
  }
}

/**
 * A page document, rebuilt field by field (and brought up to the current model
 * with `normalizeDocument`: v1 documents come in as they were saved).
 *
 * `identity` says what the page is allowed to be. A custom page is a plain
 * `builder` page; an edit of a mirrored route must keep that route's template
 * and its docs/post identity (shared/pnw/mirror-routes.ts) - the BetterDocs
 * frame and the post header look their document up by slug and throw on an
 * invented one.
 */
export function sanitizePageDocument(
  raw: unknown,
  identity: { template: PageDocument['template']; docsSlug?: string; postSlug?: string } = { template: 'builder' },
): PageDocument | null {
  return attempt(() => {
    if (!isObject(raw)) fail('document')
    const template = optOneOf(raw.template, PAGE_TEMPLATES, 'template') ?? 'builder'
    if (template !== (identity.template ?? 'builder')) fail('template')

    const document: PageDocument = { template, sections: list(raw.sections, 'sections').map(pageSection) }
    const scope = optStr(raw.scope, 100)
    if (scope) {
      if (!/^[a-z0-9_-]+$/.test(scope)) fail('scope')
      document.scope = scope
    }
    const articleClass = optClass(raw.articleClass)
    if (articleClass) document.articleClass = articleClass
    if (raw.linkOptions !== undefined && raw.linkOptions !== null) {
      document.linkOptions = objects(raw.linkOptions, 'linkOptions').map((option) => {
        const name = str(option.class, 100, 'link class')
        if (!/^et_pb_[a-z_]+_\d+$/.test(name)) fail('link class')
        return clean({
          class: name,
          url: str(option.url, 2000, 'link url'),
          target: optOneOf(option.target, ['_blank', '_self'] as const, 'link target'),
        })
      })
      for (const option of document.linkOptions) if (!isSafeHref(option.url)) fail('link url')
    }

    if (template === 'docs') {
      const slug = str(raw.docsSlug, 200, 'docsSlug')
      if (slug !== identity.docsSlug) fail('docsSlug')
      document.docsSlug = slug
      if (raw.protected === true) document.protected = true
      if (raw.body !== undefined && raw.body !== null) document.body = list(raw.body, 'body').map(pageModule)
    } else if (template === 'post') {
      if (!isObject(raw.post)) fail('post')
      const slug = str(raw.post.slug, 200, 'post slug')
      if (slug !== identity.postSlug) fail('post slug')
      const classes = list(raw.post.bodyClasses ?? [], 'bodyClasses', 100).map((name) => {
        const text = str(name, 100, 'body class')
        if (!/^[A-Za-z0-9_-]+$/.test(text)) fail('body class')
        return text
      })
      document.post = {
        slug,
        date: str(raw.post.date, 60, 'post date'),
        articleId: str(raw.post.articleId, 100, 'articleId'),
        bodyClasses: classes,
      }
    } else if (template === 'classic') {
      document.heading = str(raw.heading, MAX_LABEL, 'heading')
      document.content = richContent(raw.content ?? [])
    }
    return normalizeDocument(document)
  })
}

function menuNodes(value: unknown, depth: number): MenuNode[] {
  return list(value, 'menu').map((raw) => {
    if (!isObject(raw)) fail('menu item')
    const node: MenuNode = { label: str(raw.label, 120, 'label') }
    if (!node.label.trim()) fail('label')
    const to = optRoute(raw.to)
    if (to) node.to = to
    const href = optHref(raw.href)
    if (href && !to) node.href = href
    if (raw.children !== undefined && raw.children !== null) {
      // The theme styles two levels (a dropdown under a top-level item), no deeper.
      if (depth > 0) fail('menu depth')
      node.children = menuNodes(raw.children, depth + 1)
    }
    return node
  })
}

/** The top bar's menu is flat (depth starts at 1, so it may not have children). */
export function sanitizeSiteMenu(raw: unknown): SiteMenu | null {
  return attempt(() => {
    if (!isObject(raw)) fail('menu')
    return { primary: menuNodes(raw.primary, 0), secondary: menuNodes(raw.secondary, 1) }
  })
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/

/** A library file: something this server stored (`/uploads/...`), a mirrored one (`/media/...`) or an http(s) URL. */
function libraryFile(value: unknown): string | undefined {
  const text = optStr(value, 2000)
  if (text === undefined) return undefined
  const rootRelative = text.startsWith('/') && !text.startsWith('//')
  if (!rootRelative && !/^https?:\/\//i.test(text)) fail('file')
  return text
}

/** The Dokumentumtár: unique slugs across the whole library, every title non-empty. */
export function sanitizeLibrary(raw: unknown): DocLibrary | null {
  return attempt(() => {
    if (!isObject(raw)) fail('library')
    const categorySlugs = new Set<string>()
    const docSlugs = new Set<string>()
    const categories = list(raw.categories, 'categories', 200).map((entry) => {
      if (!isObject(entry)) fail('category')
      const slug = str(entry.slug, 120, 'slug')
      if (!SLUG.test(slug) || categorySlugs.has(slug)) fail('slug')
      categorySlugs.add(slug)
      const title = str(entry.title, 200, 'title').trim()
      if (!title) fail('title')
      const docs = list(entry.docs, 'docs', 500).map((item) => {
        if (!isObject(item)) fail('doc')
        const docSlug = str(item.slug, 120, 'slug')
        if (!SLUG.test(docSlug) || docSlugs.has(docSlug)) fail('slug')
        docSlugs.add(docSlug)
        const docTitle = str(item.title, 300, 'title').trim()
        if (!docTitle) fail('title')
        const file = libraryFile(item.file)
        return file ? { slug: docSlug, title: docTitle, file } : { slug: docSlug, title: docTitle }
      })
      return { slug, title, docs }
    })
    return { categories }
  })
}
