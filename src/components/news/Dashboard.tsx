import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import * as api from "../../lib/api";
import type { ApiUser, AuthorDashboard, ReviewerDashboard } from "../../lib/api";
import { useUsers } from "../../lib/useUsers";
import { canSubmit } from "../../../shared/pnw/permissions";
import { statusLabel } from "../../../shared/pnw/statuses";
import PostsTable from "./PostsTable";
import { btnPrimary, btnSmall, card, dotCls, emptyCls } from "./ui";
import { btnCls } from "../../pages/SchemaForm";
import { formatDateTime, hk } from "./helpers";
import type { Post } from "../../../shared/pnw/types";

/** Overview: authors see their own posts, managers see the approval queue. */
export default function Dashboard({ user }: { user: ApiUser }) {
  const [data, setData] = useState<AuthorDashboard | ReviewerDashboard | null>(null);
  const [version, setVersion] = useState(0);
  const authors = useUsers();

  useEffect(() => {
    let cancelled = false;
    api.dashboard().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  const reload = () => setVersion((v) => v + 1);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">Áttekintés</h1>
      {!data ? <div className={emptyCls}>Betöltés…</div> : data.view === "author" ? <AuthorView data={data} user={user} authors={authors} /> : <ReviewerView data={data} user={user} authors={authors} />}
      {data && <TrashCard posts={data.trash ?? []} onChange={reload} />}
    </section>
  );
}

function StatCard({ count, label, status }: { count: number; label: string; status: string }) {
  return (
    <div className={`${card} flex flex-col gap-1 p-4!`}>
      <span className={dotCls(status)} />
      <strong className="font-display text-3xl">{count}</strong>
      <span className="text-sm text-petriksoft">{label}</span>
    </div>
  );
}

function CardHeading({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {text && <p className="text-sm text-petriksoft">{text}</p>}
      </div>
      {action}
    </div>
  );
}

const statGrid = "grid grid-cols-2 gap-3 md:grid-cols-4";

function NewPostLink() {
  return (
    <Link className={btnPrimary} to={hk("new")}>
      + Új hír
    </Link>
  );
}

/** Trash: restore as a draft, or delete permanently (with confirmation). Hidden when empty. */
function TrashCard({ posts, onChange }: { posts: Post[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  if (posts.length === 0) return null;
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
      onChange();
    }
  };
  return (
    <div className={card}>
      <CardHeading title="Lomtár" text="A törölt hírek: visszaállítva piszkozatként kerülnek vissza." />
      <ul className="divide-y divide-petriklinesoft">
        {posts.map((post) => (
          <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <strong className="block">{post.title || "(Névtelen hír)"}</strong>
              <small className="text-xs text-petrikfaint">Törölve: {formatDateTime(post.modifiedAt)}</small>
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={busy} className={`${btnCls} ${btnSmall}`} onClick={() => run(() => api.untrashPost(post.id))}>
                Visszaállítás
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${btnCls} ${btnSmall}`}
                onClick={() => {
                  if (window.confirm(`Véglegesen törlöd ezt a hírt? „${post.title}” Ez nem vonható vissza.`)) void run(() => api.trashPost(post.id));
                }}
              >
                Végleges törlés
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuthorView({ data, user, authors }: { data: AuthorDashboard; user: ApiUser; authors: Map<string, ApiUser> }) {
  return (
    <>
      <div className={statGrid}>
        {Object.entries(data.counts).map(([status, count]) => (
          <StatCard key={status} count={count} label={statusLabel(status)} status={status} />
        ))}
      </div>
      <div className={card}>
        {/* Without pnw_submit_news the account cannot write posts (it may only have "Fiókok kezelése"). */}
        <CardHeading title="Saját híreim" action={canSubmit(user) ? <NewPostLink /> : undefined} />
        <PostsTable posts={data.posts} reviewer={false} user={user} authors={authors} />
      </div>
    </>
  );
}

function ReviewerView({ data, user, authors }: { data: ReviewerDashboard; user: ApiUser; authors: Map<string, ApiUser> }) {
  return (
    <>
      <div className={statGrid}>
        <StatCard count={data.pendingCount} label="Jóváhagyásra vár" status="pending" />
        <StatCard count={data.returnedCount} label="Javításra visszaküldve" status="pnw_revision" />
        <StatCard count={data.scheduledCount} label="Időzített" status="future" />
        <StatCard count={data.publishedTodayCount} label="Ma publikálva" status="publish" />
      </div>

      {canSubmit(user) && (
        <div className={card}>
          <CardHeading title="Saját piszkozatok és javítások" text="A még be nem küldött vagy javításra visszaküldött hírek." action={<NewPostLink />} />
          <PostsTable posts={data.ownWorking} reviewer={false} user={user} authors={authors} />
        </div>
      )}

      <div className={card}>
        <CardHeading title="Jóváhagyási sor" text="Legrégebbi beküldés elöl." />
        <PostsTable posts={data.pending} reviewer user={user} authors={authors} />
      </div>

      {data.scheduled.length > 0 && (
        <div className={card}>
          <CardHeading title="Következő időzített hírek" text="A rendszer automatikusan publikálja őket a megadott időpontban." />
          <PostsTable posts={data.scheduled} reviewer user={user} authors={authors} />
        </div>
      )}

      <div className={card}>
        <CardHeading title="Legutóbbi döntések" />
        <PostsTable posts={data.recent} reviewer user={user} authors={authors} />
      </div>
    </>
  );
}
