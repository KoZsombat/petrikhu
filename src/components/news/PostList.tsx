import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Post } from "../../../shared/pnw/types";
import { btnCls, inputCls } from "../../pages/SchemaForm";
import { card, emptyCls, labelCls, th } from "./ui";

type ListResponse = { posts: Post[]; totalPages: number; testMode?: boolean };

type Props = {
  /** Lekérés: keresőszó + oldalszám. */
  fetchPage: (query: string, page: number) => Promise<ListResponse>;
  searchLabel: string;
  emptyText: string;
  columns: string[];
  /** Egy sor cellái (a táblázat <tr>-jét a lista adja). */
  row: (post: Post, reload: () => Promise<void>, testMode: boolean) => ReactNode;
  /** A lista fölé kerülő extra tartalom (pl. teszt mód figyelmeztetés). */
  banner?: (testMode: boolean) => ReactNode;
  searchId: string;
};

/** A "Kint lévő hírek" és az "Archívum" közös listája: keresés, táblázat, lapozás. */
export default function PostList({ fetchPage, searchLabel, emptyText, columns, row, banner, searchId }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [testMode, setTestMode] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load(q: string, p: number): Promise<void> {
    setLoading(true);
    try {
      const result = await fetchPage(q, p);
      setPosts(result.posts);
      setTotalPages(result.totalPages);
      setTestMode(result.testMode ?? true);
    } finally {
      setLoading(false);
    }
  }

  // Oldalváltáskor újratölt: a szerverrel szinkronizálás, nem származtatott állapot.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(query, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /** Művelet (archiválás/visszaállítás) után: az utolsó sor eltűnésekor egy oldallal vissza. */
  async function reload(): Promise<void> {
    if (posts.length === 1 && page > 1) setPage(page - 1);
    else await load(query, page);
  }

  return (
    <>
      {banner?.(testMode)}
      <form
        className={`${card} p-4!`}
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          load(query, 1);
        }}
      >
        <label htmlFor={searchId} className={labelCls}>
          {searchLabel}
        </label>
        <div className="mt-1 flex gap-2">
          <input id={searchId} type="search" className={`${inputCls} mt-0!`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hír címe vagy szövege" />
          <button type="submit" className={btnCls}>
            Keresés
          </button>
        </div>
      </form>

      {loading ? (
        <div className={emptyCls}>Betöltés…</div>
      ) : posts.length === 0 ? (
        <div className={emptyCls}>{emptyText}</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} className={th}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{posts.map((post) => row(post, reload, testMode))}</tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <button className={btnCls} type="button" onClick={() => setPage((p) => p - 1)}>
              ← Előző
            </button>
          )}
          <span>
            {page} / {totalPages} oldal
          </span>
          {page < totalPages && (
            <button className={btnCls} type="button" onClick={() => setPage((p) => p + 1)}>
              Következő →
            </button>
          )}
        </div>
      )}
    </>
  );
}
