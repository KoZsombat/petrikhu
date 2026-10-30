import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n/languageContext";
import type { Post, Term } from "../../shared/pnw/types";

/** One item of GET /api/public/posts: the post without content, with a thumbnail. */
export type PostSummary = Omit<Post, "content"> & { thumbnail?: string };
import type { RowListNewsRow } from "../components/creator/RowList";
import { pageBlocks } from "../i18n/pages";

const MONTHS = {
  hu: ["JAN.", "FEBR.", "MÁRC.", "ÁPR.", "MÁJ.", "JÚN.", "JÚL.", "AUG.", "SZEPT.", "OKT.", "NOV.", "DEC."],
  en: ["JAN.", "FEB.", "MAR.", "APR.", "MAY", "JUN.", "JUL.", "AUG.", "SEP.", "OCT.", "NOV.", "DEC."],
};

/** `2026-09-21T…` → `SZEPT. 21.` (the DateTag format). */
function dateLabel(iso: string, lang: "hu" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return lang === "en" ? `${MONTHS.en[d.getMonth()]} ${d.getDate()}` : `${MONTHS.hu[d.getMonth()]} ${d.getDate()}.`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  return response.json() as Promise<T>;
}

/** The hand-written news rows in pages.json (the `hirek` page list), in the given language. */
const staticRowsFor = (lang: "hu" | "en"): RowListNewsRow[] =>
  (pageBlocks("hirek", lang)?.find((b) => b.component === "RowList" && b.variant === "news")?.values.rows ?? []) as RowListNewsRow[];
const STATIC = { hu: staticRowsFor("hu"), en: staticRowsFor("en") };

/** The latest published posts for the home page; an empty list while there are none (or the server is unreachable). */
export function useLatestPosts(limit: number): { rows: RowListNewsRow[]; loaded: boolean } {
  const { lang } = useLang();
  const rows = useNewsRows();
  const live = rows !== STATIC[lang];
  return { rows: live ? rows.slice(0, limit) : [], loaded: live };
}

/** A news row with category IDs (for filtering); RowList ignores the extra field. */
export type NewsRow = RowListNewsRow & { categoryIds?: string[] };

/** Published posts (newest first); the built-in sample rows while there are none (or the server is unreachable). */
export function useNewsRows(): NewsRow[] {
  return useNews().rows;
}

/** The news rows and the categories (for the filters). */
export function useNews(): { rows: NewsRow[]; terms: Term[] } {
  const { lang } = useLang();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  useEffect(() => {
    Promise.all([
      getJson<{ posts: PostSummary[] }>("/api/public/posts?limit=1000"),
      getJson<{ terms: Term[] }>("/api/terms").catch(() => ({ terms: [] as Term[] })),
    ])
      .then(([{ posts }, { terms }]) => {
        setPosts(posts);
        setTerms(terms);
      })
      .catch(() => {});
  }, []);

  const live = useMemo<NewsRow[]>(() => {
    const names = new Map(terms.map((t) => [t.id, t.name]));
    return posts.map((post) => ({
      title: post.title,
      excerpt: post.excerpt,
      date: dateLabel(post.date, lang),
      category: names.get(post.categoryIds[0]),
      image: post.thumbnail ? { src: post.thumbnail, alt: post.title } : undefined,
      href: `/hirek/${post.slug}`,
      categoryIds: post.categoryIds,
    }));
  }, [posts, terms, lang]);

  return { rows: live.length > 0 ? live : STATIC[lang], terms };
}
