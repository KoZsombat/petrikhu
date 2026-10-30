/**
 * The Hírkezelő's news templates ("Hírsablonok") - ported from the original
 * plugin (assets/js/pnw-ux.js in merenyimiklos/petrik-news-workflow), where
 * they are HTML snippets dropped into the editor. Here they are the same
 * structure as RichTextDocument blocks: a lead paragraph, `<h3>` headings
 * (level 3) and lists. Applying one replaces the editor's text and offers to
 * start the title with the template's own prefix.
 *
 * Pure data, no React, so it works on both sides of the wire.
 */
import type { RichTextBlock, RichTextDocument } from './types.ts'

export type NewsTemplate = {
  id: string
  name: string
  description: string
  /** Offered as the start of the title ('' = none). */
  title: string
  build: () => RichTextDocument
}

let counter = 0
const id = () => {
  counter += 1
  return `t${Date.now().toString(36)}${counter}`
}

const p = (text: string, bold = false): RichTextBlock => ({ id: id(), type: 'paragraph', runs: [{ text, ...(bold ? { bold: true } : {}) }] })
const h = (text: string): RichTextBlock => ({ id: id(), type: 'heading', level: 3, runs: [{ text }] })
const li = (text: string): RichTextBlock => ({ id: id(), type: 'bulleted-list', runs: [{ text }] })

export const NEWS_TEMPLATES: NewsTemplate[] = [
  {
    id: 'competition',
    name: 'Versenyeredmény',
    description: 'Verseny, helyezés, résztvevők és felkészítő tanár.',
    title: 'Versenyeredmény – ',
    build: () => [
      p('Örömmel számolunk be tanulóink eredményéről.', true),
      h('A versenyről'),
      p('Írd ide a verseny nevét, helyszínét és időpontját.'),
      h('Eredmények'),
      li('Tanuló neve – elért helyezés / eredmény'),
      h('Felkészítő tanár'),
      p('Írd ide a felkészítő tanár nevét.'),
      p('Gratulálunk a résztvevőknek!'),
    ],
  },
  {
    id: 'event',
    name: 'Esemény / rendezvény',
    description: 'Iskolai program, nyílt nap, előadás vagy rendezvény.',
    title: '',
    build: () => [
      p('Röviden írd le, miről szól az esemény.'),
      h('Mikor?'),
      p('Dátum és időpont.'),
      h('Hol?'),
      p('Helyszín.'),
      h('Kiknek szól?'),
      p('Résztvevők / célcsoport.'),
      h('Program'),
      p('A legfontosabb programok és tudnivalók.'),
    ],
  },
  {
    id: 'notice',
    name: 'Tájékoztató',
    description: 'Rövid, jól áttekinthető információ és teendők.',
    title: 'Tájékoztató – ',
    build: () => [
      p('Írd ide röviden a legfontosabb információt.'),
      h('Fontos tudnivalók'),
      li('Első fontos információ'),
      li('Második fontos információ'),
      h('Határidő'),
      p('Ha van határidő, írd ide.'),
      h('Teendő'),
      p('Írd le, mit kell tenni az érintetteknek.'),
    ],
  },
  {
    id: 'trip',
    name: 'Kirándulás / programbeszámoló',
    description: 'Beszámoló osztály- vagy iskolai programról.',
    title: '',
    build: () => [
      p('Rövid bevezető a programról.'),
      h('Helyszín és időpont'),
      p('Írd ide, hol és mikor volt a program.'),
      h('Mi történt?'),
      p('Rövid beszámoló a napról és a legfontosabb élményekről.'),
      h('Résztvevők'),
      p('Írd ide az érintett osztályt, csoportot vagy tanulókat.'),
    ],
  },
  {
    id: 'application',
    name: 'Pályázat / felhívás',
    description: 'Jelentkezési feltételek, határidő és szükséges teendők.',
    title: 'Felhívás – ',
    build: () => [
      p('Röviden foglald össze a lehetőséget.'),
      h('Kik jelentkezhetnek?'),
      p('Írd ide a jogosultak körét.'),
      h('Határidő'),
      p('Jelentkezési határidő.'),
      h('Jelentkezés módja'),
      p('Írd le a szükséges lépéseket.'),
      h('További információ'),
      p('Kapcsolattartó vagy további tudnivalók.'),
    ],
  },
]
