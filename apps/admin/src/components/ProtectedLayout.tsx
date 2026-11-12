import { Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
import { getMyPermissions } from "../lib/api";
import { PermissionsContext } from "../lib/permissions";
import { LanguageSwitch } from "./LanguageSwitch";

const NAV = [
  { to: "/", label: "Áttekintés", end: true, permission: "dashboard.view" },
  { to: "/posts", label: "Hírek", permission: "posts.view" },
  { to: "/teachers", label: "Tanárok", permission: "teachers.view" },
  { to: "/documents", label: "Dokumentumok", permission: "documents.view" },
  { to: "/users", label: "Felhasználók", permission: "users.view" },
];

export function ProtectedLayout() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [ready, setReady] = useState(false);
  const [permissions, setPermissions] = useState<ReadonlySet<string> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void refetch().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [refetch]);

  useEffect(() => {
    if (!session?.user.id) {
      setPermissions(null);
      return;
    }

    let active = true;
    void getMyPermissions()
      .then((result) => {
        if (active) setPermissions(new Set(result.permissions));
      })
      .catch(() => {
        if (active) setPermissions(new Set());
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (isPending || !ready) {
    return (
      <div className="grid min-h-screen place-items-center text-[13.5px] text-soft">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Munkamenet ellenőrzése…
        </span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!permissions) {
    return (
      <div className="grid min-h-screen place-items-center text-[13.5px] text-soft">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Jogosultságok betöltése…
        </span>
      </div>
    );
  }

  const links = NAV.filter((link) => permissions.has(link.permission));

  return (
    <PermissionsContext.Provider value={permissions}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-[1240px] items-center gap-6 px-6 py-3">
            <a className="flex items-center gap-2.5" href="/">
              <img className="h-auto w-[150px]" src="/img/logo-208.png" alt="Petrik Lajos" />
              <span className="border-l border-line pl-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Admin
              </span>
            </a>

            <div className="ml-auto flex items-center gap-3">
              <LanguageSwitch />
              <span className="text-xs text-faint">{session.user.email}</span>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold transition-colors hover:border-accent hover:bg-tint"
                type="button"
                onClick={async () => {
                  await authClient.signOut();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut className="size-4" aria-hidden /> Kilépés
              </button>
            </div>
          </div>

          <div className="border-t border-line-soft bg-cream">
            <nav className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-2 px-6 py-2.5" aria-label="Admin menü">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `inline-flex items-center rounded-lg px-6 py-3.5 text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-surface font-semibold text-accent-dark shadow-sm ring-1 ring-line-soft"
                        : "text-soft hover:bg-surface hover:text-ink"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-8 pb-16">
          <Outlet />
        </main>
      </div>
    </PermissionsContext.Provider>
  );
}
