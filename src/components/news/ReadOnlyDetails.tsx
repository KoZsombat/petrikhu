import type { Post } from "../../../shared/pnw/types";
import { statusLabel } from "../../../shared/pnw/statuses";
import { termNames, useTerms } from "../../lib/terms";
import PostArticle from "./PostArticle";
import { badgeCls, card } from "./ui";

/**
 * Read-only details of a post: the status badge and tags in the Hírkezelő
 * own bar, with the content below it, exactly as on the public page
 * is shown (categories in the article meta line).
 */
export default function ReadOnlyDetails({ post }: { post: Post }) {
  const tags = termNames(useTerms(), post.tagIds);

  return (
    <>
      {post.reviewNote && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Vezetői megjegyzés</strong>
          <p className="mt-1">{post.reviewNote}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={badgeCls(post.status)}>{statusLabel(post.status)}</span>
        {tags.length > 0 && <span className="text-petriksoft">Címkék: {tags.join(", ")}</span>}
      </div>
      <div className={`${card} p-0!`}>
        <PostArticle title={post.title} content={post.content} categoryIds={post.categoryIds} image={post.featuredImage} imagePosition={post.imagePosition} date={post.date} />
      </div>
    </>
  );
}
