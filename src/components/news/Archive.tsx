import { Link, useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import type { Post } from "../../../shared/pnw/types";
import { useUsers } from "../../lib/useUsers";
import { useTerms } from "../../lib/terms";
import { btnCls } from "../../pages/SchemaForm";
import PostList from "./PostList";
import { formatDateTime, hk, termLine } from "./helpers";
import { btnPrimary, btnSmall, td, tdNowrap } from "./ui";

/** Archive: non-public posts, restorable with one click. */
export default function Archive() {
  const navigate = useNavigate();
  const authors = useUsers();
  const terms = useTerms();

  async function restore(id: string, reload: () => Promise<void>): Promise<void> {
    if (!window.confirm("Biztosan visszaállítod ezt a hírt? A hír azonnal újra megjelenik a nyilvános weboldalon.")) return;
    const result = await api.restorePost(id);
    await reload();
    navigate(hk("archive", undefined, result.notice));
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark">Nem publikus tartalom</div>
          <h1 className="font-display text-3xl font-bold">Archívum</h1>
          <p className="max-w-2xl text-sm text-petriksoft">Az itt lévő hírek nem jelennek meg a weboldalon, de teljes tartalmuk megmarad és egy kattintással visszaállíthatók.</p>
        </div>
        <Link className={btnCls} to={hk("published")}>
          ← Kint lévő hírek
        </Link>
      </div>

      <PostList
        searchId="pnw-archive-search"
        searchLabel="Keresés az archívumban"
        emptyText="Az archívum jelenleg üres."
        fetchPage={api.listArchived}
        columns={["Hír", "Szerző", "Eredeti publikálás", "Archiválva", "Művelet"]}
        row={(post: Post, reload) => {
          const archiver = post.archivedById ? authors.get(post.archivedById)?.displayName : undefined;
          return (
            <tr key={post.id}>
              <td className={td}>
                <strong className="block">{post.title || "(Névtelen hír)"}</strong>
                <small className="text-xs text-petrikfaint">{termLine(terms, post)}</small>
              </td>
              <td className={td}>{authors.get(post.authorId)?.displayName ?? "—"}</td>
              <td className={tdNowrap}>{formatDateTime(post.date)}</td>
              <td className={td}>
                {formatDateTime(post.archivedAt)}
                {archiver && <small className="block text-xs text-petrikfaint">{archiver}</small>}
              </td>
              <td className={td}>
                <button type="button" className={`${btnPrimary} ${btnSmall}`} onClick={() => restore(post.id, reload)}>
                  Visszaállítás
                </button>
              </td>
            </tr>
          );
        }}
      />
    </section>
  );
}
