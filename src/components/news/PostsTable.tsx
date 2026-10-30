import { Link } from "react-router-dom";
import { STATUS } from "../../../shared/pnw/types";
import type { Post } from "../../../shared/pnw/types";
import { statusLabel } from "../../../shared/pnw/statuses";
import { canEditWorkflowPost } from "../../../shared/pnw/access";
import type { ApiUser } from "../../lib/api";
import { useTerms } from "../../lib/terms";
import { btnCls } from "../../pages/SchemaForm";
import { formatDateTime, hk, termLine } from "./helpers";
import { badgeCls, btnPrimary, btnSmall, emptyCls, td, tdNowrap, th } from "./ui";

type Props = {
  posts: Post[];
  reviewer: boolean;
  user: ApiUser;
  authors: Map<string, ApiUser>;
};

/** Posts table on the dashboard. */
export default function PostsTable({ posts, reviewer, user, authors }: Props) {
  const terms = useTerms();

  if (posts.length === 0) return <div className={emptyCls}>Nincs megjeleníthető hír.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Hír</th>
            <th className={th}>Beküldő</th>
            <th className={th}>Állapot</th>
            <th className={th}>Dátum</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td className={td}>
                <strong className="block">{post.title || "(Névtelen hír)"}</strong>
                <small className="text-xs text-petrikfaint">{termLine(terms, post)}</small>
              </td>
              <td className={td}>{authors.get(post.authorId)?.displayName ?? "—"}</td>
              <td className={td}>
                <span className={badgeCls(post.status)}>{statusLabel(post.status)}</span>
              </td>
              <td className={tdNowrap}>
                {post.status === STATUS.FUTURE ? (
                  <>
                    <small className="block text-xs text-petrikfaint">Megjelenés</small>
                    {formatDateTime(post.date)}
                  </>
                ) : post.status === STATUS.PUBLISH ? (
                  <>
                    <small className="block text-xs text-petrikfaint">Megjelent</small>
                    {formatDateTime(post.date)}
                  </>
                ) : (
                  <>
                    <small className="block text-xs text-petrikfaint">Módosítva</small>
                    {formatDateTime(post.modifiedAt)}
                  </>
                )}
              </td>
              <td className={`${tdNowrap} text-right`}>{action(post, reviewer, user)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function action(post: Post, reviewer: boolean, user: ApiUser) {
  if (reviewer && post.status === STATUS.PENDING) {
    return (
      <Link className={`${btnPrimary} ${btnSmall}`} to={hk("review", post.id)}>
        Ellenőrzés
      </Link>
    );
  }
  if (!reviewer && canEditWorkflowPost(post, user)) {
    return (
      <Link className={`${btnPrimary} ${btnSmall}`} to={hk("edit", post.id)}>
        {post.status === STATUS.REVISION ? "Módosítás" : "Szerkesztés"}
      </Link>
    );
  }
  if (post.status === STATUS.REVISION && post.authorId === user.id) {
    return (
      <Link className={`${btnPrimary} ${btnSmall}`} to={hk("edit", post.id)}>
        Módosítás
      </Link>
    );
  }
  if (post.status === STATUS.PUBLISH) {
    // Published posts are handled on the "Published posts" screen, not on the dashboard.
    return null;
  }
  return (
    <Link className={`${btnCls} ${btnSmall}`} to={hk("review", post.id)}>
      Részletek
    </Link>
  );
}
