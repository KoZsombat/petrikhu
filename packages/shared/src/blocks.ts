/**
 * The Creator's blocks. A page is `Block[]`; every block is `{ id, type, props }`, and `props` is defined by
 * one zod schema here. The server validates with these schemas, the public site renders by `type`, and the
 * admin generates the editing form from them: `.meta({ title, widget })` gives a field its label and input.
 */
import { z } from 'zod'
import { isImageSrc, isSafeHref } from './links.ts'
import { richDocSchema } from './tiptap.ts'

export type Widget = 'textarea' | 'image' | 'url' | 'richtext' | 'file'

const field = <T extends z.ZodType>(schema: T, title: string, widget?: Widget): T =>
  schema.meta({ title, ...(widget ? { widget } : {}) }) as T

const str = (title: string, max = 300) => field(z.string().trim().min(1).max(max), title)
const optStr = (title: string, max = 300) => field(z.string().trim().max(max), title).optional()
const area = (title: string, max = 5000) => field(z.string().trim().min(1).max(max), title, 'textarea')
const optArea = (title: string, max = 5000) => field(z.string().trim().max(max), title, 'textarea').optional()
const href = (title: string) => field(z.string().trim().max(2000).refine(isSafeHref, 'unsafe_link'), title, 'url')
const optHref = (title: string) => field(z.string().trim().max(2000).refine((v) => v === '' || isSafeHref(v), 'unsafe_link'), title, 'url').optional()
const imageSrc = (title: string) => field(z.string().trim().max(2000).refine(isImageSrc, 'unsafe_src'), title, 'image')
const rich = (title: string) => field(richDocSchema, title, 'richtext')
const limit = field(z.number().int().min(0).max(1000), 'Megjelenített elemek maximuma').optional()
const list = <T extends z.ZodType>(item: T, title: string, max = 300) => field(z.array(item).max(max), title)
const image = (title: string) =>
  field(z.object({ src: imageSrc('Kép'), alt: field(z.string().trim().max(300), 'Alternatív szöveg') }), title).optional()

export const BLOCK_SCHEMAS = {
  pageTitle: z.object({
    breadcrumb: list(z.object({ label: str('Felirat', 120), href: optHref('Link (az utolsónál üres)') }), 'Morzsamenü', 10),
    title: str('Cím'),
    intro: optArea('Bevezető', 1000),
    cover: image('Borítókép'),
  }),

  richText: z.object({ content: rich('Tartalom') }),

  feature: z.object({
    eyebrow: optStr('Felülcím'),
    title: str('Cím'),
    content: rich('Szöveg').optional(),
    image: image('Kép'),
    imageSide: field(z.enum(['left', 'right']), 'Kép helye').default('left'),
    ctaLabel: optStr('Gomb felirata', 80),
    ctaHref: optHref('Gomb linkje'),
  }),

  callout: z.object({
    title: optStr('Cím'),
    content: rich('Szöveg'),
    tone: field(z.enum(['info', 'accent', 'highlight']), 'Stílus').default('info'),
  }),

  cards: z.discriminatedUnion('variant', [
    z.object({
      variant: field(z.literal('text'), 'Szöveges kártyák'),
      heading: optStr('Címsor'),
      columns: field(z.union([z.literal(2), z.literal(3), z.literal(4)]), 'Oszlopok').default(3),
      items: list(
        z.object({
          title: str('Cím'),
          text: optArea('Szöveg'),
          eyebrow: optStr('Felülcím'),
          date: optStr('Dátum', 40),
          href: optHref('Link'),
          linkLabel: optStr('Link felirata', 80),
        }),
        'Kártyák',
      ),
      limit,
    }),
    z.object({
      variant: field(z.literal('person'), 'Személyek'),
      heading: optStr('Címsor'),
      columns: field(z.union([z.literal(2), z.literal(3), z.literal(4)]), 'Oszlopok').default(3),
      items: list(
        z.object({
          name: str('Név', 120),
          role: optStr('Beosztás'),
          room: optArea('Szoba', 300),
          phone: optStr('Telefon', 60),
          email: optStr('E-mail', 120),
          photo: field(z.string().trim().max(2000).refine((v) => v === '' || isImageSrc(v), 'unsafe_src'), 'Fénykép', 'image').optional(),
        }),
        'Személyek',
      ),
      limit,
    }),
    z.object({
      variant: field(z.literal('stat'), 'Számok'),
      columns: field(z.union([z.literal(3), z.literal(4)]), 'Oszlopok').default(4),
      items: list(z.object({ value: str('Érték', 40), label: str('Felirat', 120) }), 'Számok', 40),
      limit,
    }),
  ]),

  rows: z.discriminatedUnion('variant', [
    z.object({
      variant: field(z.literal('fact'), 'Adatsorok'),
      heading: optStr('Címsor'),
      rows: list(z.object({ label: str('Felirat'), value: area('Érték', 2000) }), 'Sorok'),
      limit,
    }),
    z.object({
      variant: field(z.literal('step'), 'Lépések'),
      heading: optStr('Címsor'),
      rows: list(z.object({ key: str('Kulcs (pl. dátum)', 60), text: area('Szöveg', 2000) }), 'Lépések'),
      limit,
    }),
  ]),

  checkList: z.object({
    title: optStr('Cím'),
    items: list(field(z.string().trim().min(1).max(500), 'Pont'), 'Pontok', 100),
    sideTitle: optStr('Oldalsó cím'),
    sideText: optArea('Oldalsó szöveg'),
    limit,
  }),

  linkList: z.object({
    heading: optStr('Címsor'),
    items: list(z.object({ title: str('Cím'), href: optHref('Link (üres: sima felsorolás)'), meta: optStr('Megjegyzés') }), 'Linkek'),
    limit,
  }),

  logoGrid: z.object({
    label: optStr('Felirat'),
    logos: list(
      z.object({
        alt: str('Név / alt'),
        src: field(z.string().trim().max(2000).refine((v) => v === '' || isImageSrc(v), 'unsafe_src'), 'Logó', 'image').optional(),
        href: optHref('Link'),
      }),
      'Logók',
      100,
    ),
    limit,
  }),

  gallery: z.object({
    heading: optStr('Címsor'),
    columns: field(z.union([z.literal(3), z.literal(4)]), 'Oszlopok').default(3),
    images: list(z.object({ src: imageSrc('Kép'), alt: optStr('Alternatív szöveg') }), 'Képek', 200),
    limit,
  }),

  table: z.object({
    heading: optStr('Címsor'),
    columns: list(field(z.string().trim().max(200), 'Oszlopfejléc'), 'Oszlopfejlécek', 20),
    rows: list(z.object({ cells: list(field(z.string().trim().max(2000), 'Cella'), 'Cellák (az oszlopok sorrendjében)', 20) }), 'Sorok', 500),
    footnote: optStr('Lábjegyzet', 500),
    limit,
  }),

  video: z.object({
    heading: optStr('Címsor'),
    url: href('YouTube-link'),
    title: optStr('Cím'),
    caption: optStr('Képaláírás', 500),
  }),

  accordion: z.object({
    heading: optStr('Címsor'),
    items: list(z.object({ title: str('Cím'), content: rich('Tartalom') }), 'Elemek', 100),
    openFirst: field(z.boolean(), 'Az első elem nyitva').default(false),
  }),

  cta: z.object({
    title: str('Cím'),
    buttonLabel: str('Gomb felirata', 80),
    href: href('Gomb linkje'),
  }),

  newsList: z.object({
    category: optStr('Csak ebből a kategóriából (üres: mind)', 120),
    limit,
    paginate: field(z.boolean(), 'Lapozó (10 hír / oldal)').default(false),
    filters: list(z.object({ label: str('Felirat', 80), category: optStr('Kategória (üres: mind)', 120) }), 'Szűrőgombok', 30).optional(),
    items: list(
      z.object({
        title: str('Cím'),
        excerpt: optArea('Kivonat', 1000),
        date: str('Dátum', 40),
        category: optStr('Kategória', 120),
        image: image('Kép'),
        href: href('Link'),
      }),
      'Kézzel megadott hírek (üres: a legfrissebb hírek)',
    ).optional(),
  }),

  documentLibrary: z.object({
    intro: optStr('Felülcím', 200),
  }),
} as const

export type BlockType = keyof typeof BLOCK_SCHEMAS
export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[]

export type BlockProps<T extends BlockType> = z.output<(typeof BLOCK_SCHEMAS)[T]>

export type Block = { [T in BlockType]: { id: string; type: T; props: BlockProps<T> } }[BlockType]

export const BLOCK_LABELS: Record<BlockType, { label: string; description: string }> = {
  pageTitle: { label: 'Oldalcím', description: 'Morzsamenü, cím, bevezető, borítókép. Az oldal tetejére.' },
  richText: { label: 'Szöveg', description: 'Formázott szöveg címsorokkal, listákkal, képekkel.' },
  feature: { label: 'Kép + szöveg', description: 'Két oszlop: kép és szöveg, gombbal.' },
  callout: { label: 'Kiemelt közlemény', description: 'Kiemelt doboz fontos információhoz.' },
  cards: { label: 'Kártyák', description: 'Szöveges kártyák, személyek vagy számok rácsban.' },
  rows: { label: 'Sorlista', description: 'Adatsorok (címke – érték) vagy lépések.' },
  checkList: { label: 'Pipalista', description: 'Pipás felsorolás, oldalsó szöveggel.' },
  linkList: { label: 'Linklista', description: 'Linkek, letölthető dokumentumok.' },
  logoGrid: { label: 'Logórács', description: 'Partnerek logói.' },
  gallery: { label: 'Képgaléria', description: 'Képek rácsban.' },
  table: { label: 'Táblázat', description: 'Oszlopfejlécek és sorok.' },
  video: { label: 'Videó', description: 'Beágyazott YouTube-videó.' },
  accordion: { label: 'Lenyíló lista', description: 'Kérdések és válaszok, lenyíló szakaszok.' },
  cta: { label: 'Felhívás-sáv', description: 'Cím és gomb, az oldal aljára (legfeljebb egy).' },
  newsList: { label: 'Hírlista', description: 'A legfrissebb hírek (szűrhető, lapozható), vagy kézzel megadott hírek.' },
  documentLibrary: { label: 'Dokumentumtár', description: 'A dokumentumtár kereshető listája.' },
}

const blockSchemaOf = <T extends BlockType>(type: T) =>
  z.object({ id: z.string().min(1).max(64), type: z.literal(type), props: BLOCK_SCHEMAS[type] })

export const blockSchema = z.discriminatedUnion(
  'type',
  BLOCK_TYPES.map((type) => blockSchemaOf(type)) as unknown as [ReturnType<typeof blockSchemaOf<'richText'>>],
) as unknown as z.ZodType<Block>

export const blocksSchema = z.array(blockSchema).min(1).max(200)

let counter = 0
export function blockId(): string {
  counter += 1
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
