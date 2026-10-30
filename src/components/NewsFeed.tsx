import { useSearchParams } from "react-router-dom";
import { PageRenderer } from "./creator";
import type { PageBlock } from "./creator";
import { useNews } from "../lib/news";

const PER_PAGE = 10;

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * A /hirek oldal: a beépített blokkok közül a hírlista helyére a kiadott
 * hírek kerülnek (ha nincs, a beépített minta-sorok maradnak), valódi
 * lapozással (?oldal=N) és kategóriaszűrővel (?kategoria=<név>, mint a régi
 * oldal kategória-archívumai: egy főkategória az alkategóriák híreit is mutatja).
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
            // A kiválasztott szűrő legyen aktív.
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
