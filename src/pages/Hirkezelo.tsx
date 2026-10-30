import { useSearchParams } from "react-router-dom";
import AdminGate from "../components/AdminGate";
import type { ApiUser } from "../lib/api";
import { canManagePublished, canManageUsers, canSubmit, canViewAuditLog, hasNewsPermission } from "../../shared/pnw/permissions";
import NewsShell from "../components/news/NewsShell";
import Unauthorized from "../components/news/Unauthorized";
import Dashboard from "../components/news/Dashboard";
import Editor from "../components/news/Editor";
import Review from "../components/news/Review";
import Published from "../components/news/Published";
import Archive from "../components/news/Archive";
import Statistics from "../components/news/Statistics";
import Audit from "../components/news/Audit";
import Users from "../components/news/Users";

/**
 * /hirkezelo - the Hírkezelő screens. The screen is chosen by ?pnw_view=
 * (dashboard, new, edit, review, published, published_edit, archive, stats,
 * audit, users); the post is ?post_id=, the notice is ?pnw_notice=.
 * Any news permission is enough to log in; which screens are available is decided per view.
 */
export default function Hirkezelo() {
  return (
    <AdminGate allow={hasNewsPermission} deniedText="Ehhez a felülethez legalább egy hírkezelési jogosultság kell. Kérd meg valamelyik fiókkezelőt, hogy állítsa be a fiókodon.">
      {(user, logout) => <Screens user={user} logout={logout} />}
    </AdminGate>
  );
}

function Screens({ user, logout }: { user: ApiUser; logout: () => Promise<void> }) {
  const [params] = useSearchParams();
  const view = params.get("pnw_view") ?? "dashboard";
  const postId = params.get("post_id") ?? undefined;
  const denied = <Unauthorized onLogout={logout} />;

  let content;
  switch (view) {
    case "new":
      content = canSubmit(user) ? <Editor key="new" user={user} /> : denied;
      break;
    case "edit":
      content = postId ? <Editor key={postId} user={user} postId={postId} /> : <Dashboard user={user} />;
      break;
    case "review":
      content = postId ? <Review key={postId} user={user} postId={postId} /> : <Dashboard user={user} />;
      break;
    case "published":
      content = canManagePublished(user) ? <Published /> : denied;
      break;
    case "published_edit":
      content = postId && canManagePublished(user) ? <Editor key={postId} user={user} postId={postId} published /> : <Dashboard user={user} />;
      break;
    case "archive":
      content = canManagePublished(user) ? <Archive /> : denied;
      break;
    case "stats":
      content = canViewAuditLog(user) ? <Statistics /> : denied;
      break;
    case "audit":
      content = canViewAuditLog(user) ? <Audit /> : denied;
      break;
    case "users":
      content = canManageUsers(user) ? <Users currentUserId={user.id} /> : denied;
      break;
    default:
      content = <Dashboard user={user} />;
  }

  return (
    <NewsShell user={user} onLogout={logout}>
      {content}
    </NewsShell>
  );
}
