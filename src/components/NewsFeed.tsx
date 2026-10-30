import { useSearchParams } from "react-router-dom";
import { PageRenderer } from "./creator";
import type { PageBlock } from "./creator";
import { useNews } from "../lib/news";

const PER_PAGE = 10;

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * The /hirek page: in place of the news list among the built-in blocks, the published
 * posts go in (if there are none, the built-in sample rows stay), with real
 * paging (?oldal=N) and a category filter (?kategoria=<name>, like the old
 * site's category archives: a main category also shows the posts of its subcategories).
 */
export function NewsFeed({ content }: { content: PageBlock[] }) {
  const { rows: all, terms } = useNews();
  const [params] = useSearchParams();
  const category = params.get("kategoria") ?? "";
  const term = category ? terms.find((t) => fold(t.name) === fold(category)) : undefined;
  const rows = term ? all.filter((row) => row.categoryIds?.some((id) => id.startsWith(term.id))) : all;

  const total = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(total, Math.max(1, Number(params.get("oldal")) || 1));
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const blocks = content.map((block) =>
    block.component === "RowList" && block.variant === "news"
      ? {
          ...block,
          values: {
            ...block.values,
            rows: slice,
            pagination: { current, total },
            // The selected filter should be active.
            filters: (block.values.filters as { label: string; href: string }[] | undefined)?.map((f) => ({
              ...f,
              active: category ? fold(f.label) === fold(category) : f.href === "/hirek",
            })),
          },
        }
      : block,
  );
  return <PageRenderer content={blocks} />;
}
