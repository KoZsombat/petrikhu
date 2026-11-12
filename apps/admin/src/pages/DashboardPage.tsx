import { BookOpen, Check, FileText, GraduationCap, RotateCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { usePermissions } from "../lib/permissions";
import { listPosts, listUsers, publicCounts, reviewPost } from "../lib/api";
import type { Post } from "../lib/schemas";
import {
  actions,
  badgePending,
  button,
  buttonPrimary,
  code,
  eyebrow,
  iconButton,
  muted,
  page,
  pageTitle,
  panel,
  panelTitle,
  table,
  tableWrap,
  td,
  th,
} from "../lib/ui";

const STATUS_LABEL = {
  draft: "Piszkozat",
  pending: "Jóváhagyásra vár",
  published: "Publikált",
} as const;

export function DashboardPage() {
  const permissions = usePermissions();
  const canReview = permissions.has("posts.review");
  const canWritePosts = permissions.has("posts.view");
  const canViewUsers = permissions.has("users.view");
  const canManageUsers = permissions.has("users.manage");
  const canManageTeachers = permissions.has("teachers.manage");
  const canManageDocuments = permissions.has("documents.manage");

  const [counts, setCounts] = useState<{
    posts: number;
    teachers: number;
    documents: number;
    users: number | null;
  } | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [content, users, allPosts] = await Promise.all([
        publicCounts(),
        canViewUsers ? listUsers() : Promise.resolve(null),
        canWritePosts ? listPosts() : Promise.resolve(null),
      ]);
      setCounts({ ...content, users: users?.length ?? null });
      setPosts(allPosts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    void load();
  }, [canWritePosts, canViewUsers]);

  const decide = async (post: Post, decision: "approve" | "reject") => {
    const note =
      decision === "reject"
        ? (window.prompt("Miért küldöd vissza? (opcionális)") ?? undefined)
        : undefined;
    try {
      await reviewPost(post.id, decision, note);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const pending = posts?.filter((post) => post.status === "pending") ?? [];

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Petrik Lajos</span>
          <h1 className={`mt-1 ${pageTitle}`}>Áttekintés</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            Hírek, tanárok, dokumentumok és fiókok egy helyen.
          </p>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-[#f0d3ce] bg-[#fdf4f2] px-3 py-2 text-[13px] text-[#b42318]">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {[
          { to: "/posts", value: counts?.posts, label: "Hírek", icon: FileText },
          { to: "/teachers", value: counts?.teachers, label: "Tanárok", icon: GraduationCap },
          { to: "/documents", value: counts?.documents, label: "Dokumentumok", icon: BookOpen },
          ...(canViewUsers
            ? [{ to: "/users", value: counts?.users, label: "Felhasználók", icon: Users }]
            : []),
        ].map((stat) => (
          <Link
            key={stat.to}
            className="rounded-xl border border-line-soft bg-surface px-5 py-4 transition hover:border-accent"
            to={stat.to}
          >
            <p className="font-display text-[38px] font-semibold leading-none tabular-nums text-accent-dark">
              {stat.value ?? "—"}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              <stat.icon className="size-3.5" aria-hidden /> {stat.label}
            </p>
          </Link>
        ))}
      </section>

      {canWritePosts ? (
        <section className={panel}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className={`${panelTitle} mb-0`}>
              Jóváhagyásra váró hírek <span className={muted}>({pending.length})</span>
            </h2>
            <Link className={button} to="/posts">
              Összes hír
            </Link>
          </div>

          {posts === null ? (
            <p className={muted}>Betöltés…</p>
          ) : pending.length === 0 ? (
            <p className={muted}>Nincs jóváhagyásra váró hír.</p>
          ) : (
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Cím</th>
                    <th className={th}>Kategória</th>
                    <th className={th}>Állapot</th>
                    {canReview ? <th className={th} aria-label="Műveletek" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((post) => (
                    <tr key={post.id}>
                      <td className={td}>
                        <strong>{post.title}</strong>
                        <div className={code}>/{post.slug}</div>
                      </td>
                      <td className={td}>{post.category}</td>
                      <td className={td}>
                        <span className={badgePending}>{STATUS_LABEL.pending}</span>
                      </td>
                      {canReview ? (
                        <td className={td}>
                          <div className={actions}>
                            <button
                              className={iconButton}
                              type="button"
                              title="Jóváhagyás"
                              onClick={() => void decide(post, "approve")}
                            >
                              <Check className="size-3.5" aria-hidden />
                            </button>
                            <button
                              className={iconButton}
                              type="button"
                              title="Visszaküldés"
                              onClick={() => void decide(post, "reject")}
                            >
                              <RotateCcw className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className={panel}>
        <h2 className={panelTitle}>Gyors műveletek</h2>
        <div className="flex flex-wrap gap-2.5">
          {canWritePosts ? (
            <Link className={buttonPrimary} to="/posts">
              Új hír
            </Link>
          ) : null}
          {canManageTeachers ? (
            <Link className={button} to="/teachers">
              Tanár hozzáadása
            </Link>
          ) : null}
          {canManageDocuments ? (
            <Link className={button} to="/documents">
              Dokumentum feltöltése
            </Link>
          ) : null}
          {canManageUsers ? (
            <Link className={button} to="/users">
              Felhasználó létrehozása
            </Link>
          ) : null}
          {permissions.size <= 1 ? (
            <p className={muted}>
              A fiókodhoz még nincs hozzáférés rendelve. Kérj szerepkört egy adminisztrátortól.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
