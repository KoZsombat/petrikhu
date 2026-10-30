/**
 * A hírkeresés szövege (`posts.search_text`): a cím és a hír sima szövege, kisbetűsen. Ugyanaz, amiben a
 * korábbi JavaScript-szűrő keresett (blockText), csak előre kiszámolva - így a keresés az adatbázisban fut
 * (`LIKE`), és a tárolt JSON kulcsai ("runs", "paragraph") sem találatok. A kisbetűsítés itt, nem SQL-ben
 * történik, így az eredmény nem függ az adatbázis locale-jától.
 */
import { documentText } from '../../shared/pnw/richtext.ts'
import type { RichTextDocument } from '../../shared/pnw/types.ts'

export function searchTextOf(title: string, content: RichTextDocument): string {
  return `${title}\n${documentText(content)}`.toLowerCase()
}

/** A keresőkifejezés `LIKE`-mintaként: a %, _ és \ szó szerint értendő. */
export function likePattern(query: string): string {
  return `%${query.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`
}
