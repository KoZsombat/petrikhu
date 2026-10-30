import { Link, useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import type { Post } from "../../../shared/pnw/types";
import { useUsers } from "../../lib/useUsers";
import { useTerms } from "../../lib/terms";
import { btnCls } from "../../pages/SchemaForm";
import PostList from "./PostList";
import { formatDateTime, hk, termLine } from "./helpers";
import { actionsCls, btnDanger, btnPrimary, btnSmall, td, tdNowrap } from "./ui";

/** Kint lévő hírek: keresés, szerkesztés, archiválás. */
export default function Published() {
  const navigate = useNavigate();
  const authors = useUsers();
  const terms = useTerms();

  async function archive(id: string, reload: () => Promise<void>): Promise<void> {
    if (!window.confirm("Biztosan archiválod ezt a hírt? Az oldalról azonnal eltűnik, de az Archívumból bármikor visszaállítható.")) return;
    const result = await api.archivePost(id);
    await reload();
    navigate(hk("published", undefined, result.notice));
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark">Publikált tartalom</div>
          <h1 className="font-display text-3xl font-bold">Kint lévő hírek</h1>
          <p className="max-w-2xl text-sm text-petriksoft">A lista a Hírkezelőből jóváhagyott és a régi oldalról átvett híreket tartalmazza. Az Archiválás leveszi a hírt a weboldalról, de nem törli.</p>
        </div>
        <Link className={btnCls} to={hk("archive")}>
          Archívum
        </Link>
      </div>

      <PostList
        searchId="pnw-published-search"
        searchLabel="Keresés a publikált hírek között"
        emptyText="Nincs megjeleníthető publikált hír."
        fetchPage={api.listPublished}
        columns={["Hír", "Szerző", "Publikálva", "Forrás", "Műveletek"]}
        banner={(testMode) =>
          testMode ? (
            <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>TESZT MÓD:</strong> a jelenlegi éles hírek megtekinthetők, de szerkesztésük és archiválásuk blokkolva van a production indulásig.
            </div>
          ) : null
        }
        row={(post: Post, reload, testMode) => (
          <tr key={post.id}>
            <td className={td}>
              <strong className="block">{post.title || "(Névtelen hír)"}</strong>
              <small className="text-xs text-petrikfaint">{termLine(terms, post)}</small>
            </td>
            <td className={td}>{authors.get(post.authorId)?.displayName ?? "—"}</td>
            <td className={tdNowrap}>
              <time dateTime={post.date}>{formatDateTime(post.date)}</time>
            </td>
            <td className={tdNowrap}>{post.origin === "mirror" ? "Régi oldal" : "Hírkezelő"}</td>
            <td className={td}>
              <div className={actionsCls}>
                <Link className={`${btnPrimary} ${btnSmall}`} to={hk("published_edit", post.id)}>
                  {testMode ? "Részletek" : "Szerkesztés"}
                </Link>
                {!testMode && (
                  <button type="button" className={`${btnDanger} ${btnSmall}`} onClick={() => archive(post.id, reload)}>
                    Archiválás
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
    </section>
  );
}
