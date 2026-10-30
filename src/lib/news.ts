import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n/languageContext";
import type { Post, Term } from "../../shared/pnw/types";

/** A GET /api/public/posts listaeleme: a hír tartalom nélkül, miniatűrrel. */
export type PostSummary = Omit<Post, "content"> & { thumbnail?: string };
import type { RowListNewsRow } from "../components/creator/RowList";
import { pageBlocks } from "../i18n/pages";

const MONTHS = {
  hu: ["JAN.", "FEBR.", "MÁRC.", "ÁPR.", "MÁJ.", "JÚN.", "JÚL.", "AUG.", "SZEPT.", "OKT.", "NOV.", "DEC."],
  en: ["JAN.", "FEB.", "MAR.", "APR.", "MAY", "JUN.", "JUL.", "AUG.", "SEP.", "OCT.", "NOV.", "DEC."],
};

/** `2026-09-21T…` → `SZEPT. 21.` (a DateTag formátuma). */
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

/** A pages.json-ban lévő, kézzel írt hírsorok (a `hirek` oldal hírlistája) az adott nyelven. */
const staticRowsFor = (lang: "hu" | "en"): RowListNewsRow[] =>
  (pageBlocks("hirek", lang)?.find((b) => b.component === "RowList" && b.variant === "news")?.values.rows ?? []) as RowListNewsRow[];
const STATIC = { hu: staticRowsFor("hu"), en: staticRowsFor("en") };

/** A legfrissebb kiadott hírek a kezdőlapnak; amíg nincsenek (vagy a szerver nem elérhető), üres lista. */
export function useLatestPosts(limit: number): { rows: RowListNewsRow[]; loaded: boolean } {
  const { lang } = useLang();
  const rows = useNewsRows();
  const live = rows !== STATIC[lang];
  return { rows: live ? rows.slice(0, limit) : [], loaded: live };
}

/** Egy hírsor a kategória-azonosítókkal (a szűréshez); a RowList a többletmezőt figyelmen kívül hagyja. */
export type NewsRow = RowListNewsRow & { categoryIds?: string[] };

/** A kiadott hírek (legfrissebb elöl); amíg nincs egy sem (vagy a szerver nem elérhető), a beépített minta-sorok. */
export function useNewsRows(): NewsRow[] {
  return useNews().rows;
}

/** A hírsorok és a kategóriák (a szűrőkhöz). */
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
