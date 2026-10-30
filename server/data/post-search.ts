/**
 * The post search text (`posts.search_text`): the title and the plain text of the post, lowercased. The same thing the
 * earlier JavaScript filter searched (blockText), only precomputed - so the search runs in the database
 * (`LIKE`), and the stored JSON keys ("runs", "paragraph") do not match. Lowercasing happens here, not in SQL,
 * so the result does not depend on the database locale.
 */
import { documentText } from '../../shared/pnw/richtext.ts'
import type { RichTextDocument } from '../../shared/pnw/types.ts'

export function searchTextOf(title: string, content: RichTextDocument): string {
  return `${title}\n${documentText(content)}`.toLowerCase()
}

/** The search term as a `LIKE` pattern: %, _ and \ are taken literally. */
export function likePattern(query: string): string {
  return `%${query.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`
}
