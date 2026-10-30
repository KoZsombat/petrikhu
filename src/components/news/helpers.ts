import type { Post, RichTextDocument, Term } from "../../../shared/pnw/types";
import { emptyDocument } from "../../../shared/pnw/richtext";
import { isLegacyBlocks, richToBlocks, toRichContent } from "../../../shared/pnw/rich-content";
import { termNames } from "../../lib/terms";

/** URL of a Hírkezelő screen: /hirkezelo?pnw_view=…&post_id=…&pnw_notice=… */
export function hk(view?: string, postId?: string, notice?: string): string {
  const params = new URLSearchParams();
  if (notice) params.set("pnw_notice", notice);
  if (view) params.set("pnw_view", view);
  if (postId) params.set("post_id", postId);
  const query = params.toString();
  return query ? `/hirkezelo?${query}` : "/hirkezelo";
}

/** One line of classification under the list title: categories, then tags. */
export function termLine(terms: Term[], post: Post): string {
  const categoryPart = post.categoryIds.length === 0 ? "Nincs kategória" : termNames(terms, post.categoryIds).join(", ");
  const tags = termNames(terms, post.tagIds);
  return tags.length === 0 ? categoryPart : `${categoryPart} · Címkék: ${tags.join(", ")}`;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Creator blocks: the post content (blocks or content tree) is always converted to a block list, with at least one empty block. */
export function asBlocks(content: unknown): RichTextDocument {
  if (isLegacyBlocks(content)) return content;
  const blocks = richToBlocks(toRichContent(content));
  return blocks.length ? blocks : emptyDocument();
}
