import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { ApiUser } from "../../lib/api";
import { canManagePublished, canManageUsers, canSubmit, canViewAuditLog, canManagePages, permissionSummary } from "../../../shared/pnw/permissions";
import AdminHeader from "../AdminHeader";
import { hk } from "./helpers";
import Notice from "./Notice";

/** A Hírkezelő kerete: fejléc a felhasználóval, füles navigáció, alatta a képernyő. */
export default function NewsShell({ user, onLogout, children }: { user: ApiUser; onLogout: () => void; children: ReactNode }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const view = pathname === "/hirkezelo" ? (params.get("pnw_view") ?? "dashboard") : "";

  const tabs: { label: string; view: string; match: string[] }[] = [{ label: "Áttekintés", view: "", match: ["dashboard", "review", "edit"] }];
  if (canSubmit(user)) tabs.push({ label: "+ Új hír", view: "new", match: ["new"] });
  if (canManagePublished(user)) {
    tabs.push({ label: "Kint lévő hírek", view: "published", match: ["published", "published_edit"] });
    tabs.push({ label: "Archívum", view: "archive", match: ["archive"] });
  }
  if (canViewAuditLog(user)) {
    tabs.push({ label: "Statisztika", view: "stats", match: ["stats"] });
    tabs.push({ label: "Napló", view: "audit", match: ["audit"] });
  }
  if (canManageUsers(user)) tabs.push({ label: "Fiókok", view: "users", match: ["users"] });

  return (
    <>
      <AdminHeader title="Hírkezelő" name={user.displayName} hint={permissionSummary(user)} onLogout={onLogout} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <nav className="flex flex-wrap gap-2 border-b border-petriklinesoft pb-6" aria-label="Hírkezelő navigáció">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.view ? hk(tab.view) : hk()}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${tab.match.includes(view) ? "bg-petrikaccent text-petrikcard" : "border border-petrikline bg-petrikcard text-petriksoft hover:bg-petriktint"}`}
            >
              {tab.label}
            </Link>
          ))}
          {/* A Creator ugyanezzel a belépéssel nyílik. */}
          {canManagePages(user) && (
            <Link to="/dashboard" className="rounded-md border border-petrikline bg-petrikcard px-4 py-2 text-sm font-semibold text-petriksoft hover:bg-petriktint">
              Oldalszerkesztő →
            </Link>
          )}
        </nav>
        <Notice />
        {children}
      </main>
    </>
  );
}
