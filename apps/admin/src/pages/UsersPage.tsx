import { Check, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "../components/Dialog";
import { PermissionPicker } from "../components/PermissionPicker";
import { authClient } from "../lib/auth-client";
import {
  createUser,
  deleteUser,
  getPermissionCatalog,
  listUsers,
  updateUser,
} from "../lib/api";
import { usePermissions } from "../lib/permissions";
import {
  createUserSchema,
  type AdminUser,
  type CreateUserInput,
  type PermissionCatalog,
} from "../lib/schemas";
import {
  actions,
  badgePending,
  buttonPrimary,
  code,
  empty,
  eyebrow,
  field,
  fieldError,
  form,
  formError,
  iconButton,
  iconButtonDanger,
  input,
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

const emptyDraft: CreateUserInput = {
  name: "",
  email: "",
  password: "",
  permissions: ["dashboard.view"],
};
type FieldErrors = Record<string, string | undefined>;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium" }).format(new Date(value));

export function UsersPage() {
  const { data: session } = authClient.useSession();
  const permissions = usePermissions();
  const currentId = session?.user.id;

  const canView = permissions.has("users.view");
  const canManage = permissions.has("users.manage");
  const canGrant = permissions.has("users.permissions");

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateUserInput>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantSelection, setGrantSelection] = useState<Set<string>>(new Set());
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSaving, setGrantSaving] = useState(false);

  const refresh = async () => {
    try {
      setError(null);
      setUsers(await listUsers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Betöltési hiba");
    }
  };

  useEffect(() => {
    if (!canView) return;
    void refresh();
    void getPermissionCatalog()
      .then(setCatalog)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Jogosultságlista hiba"),
      );
  }, [canView]);

  if (!canView) {
    return (
      <div className={page}>
        <section className={panel}>
          <h2 className={panelTitle}>Nincs jogosultság</h2>
          <p className={muted}>A felhasználók kezeléséhez `users.view` jogosultság szükséges.</p>
        </section>
      </div>
    );
  }

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const parsed = createUserSchema.safeParse(draft);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }

    setSaving(true);
    try {
      await createUser(parsed.data);
      setDraft(emptyDraft);
      setFormOpen(false);
      await refresh();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (entry: AdminUser) => {
    const password = window.prompt(`Új jelszó — ${entry.email} (min. 8 karakter)`);
    if (!password) return;
    if (password.length < 8) {
      setError("A jelszó legalább 8 karakter legyen.");
      return;
    }
    try {
      await updateUser(entry.id, { password });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const remove = async (entry: AdminUser) => {
    if (!window.confirm(`Törlöd: ${entry.email}?`)) return;
    try {
      await deleteUser(entry.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hiba");
    }
  };

  const openGrants = (entry: AdminUser) => {
    setGrantUser(entry);
    setGrantSelection(new Set(entry.permissions));
    setGrantError(null);
  };

  const saveGrants = async () => {
    if (!grantUser) return;
    setGrantSaving(true);
    setGrantError(null);
    try {
      const updated = await updateUser(grantUser.id, {
        permissions: [...grantSelection],
      });
      setUsers((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setGrantUser(null);
    } catch (cause) {
      setGrantError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setGrantSaving(false);
    }
  };

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>Hozzáférés</span>
          <h1 className={`mt-1 ${pageTitle}`}>Felhasználók</h1>
          <p className="mt-1.5 text-[14.5px] text-soft">
            Fiókok és jogosultságok kezelése.
          </p>
        </div>
        {canManage ? (
          <button className={buttonPrimary} type="button" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden /> Új felhasználó
          </button>
        ) : null}
      </header>

      {error ? <p className={formError}>{error}</p> : null}

      <section className={panel}>
        <h2 className={panelTitle}>Fiókok</h2>

        {users === null ? (
          <p className={empty}><Loader2 className="mx-auto mb-1 size-4 animate-spin" /> Betöltés…</p>
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Név</th>
                  <th className={th}>E-mail</th>
                  <th className={th}>Jogosultságok</th>
                  <th className={th}>Létrehozva</th>
                  <th className={th} aria-label="Műveletek" />
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.id}>
                    <td className={td}>
                      <strong>{entry.name}</strong>
                      {entry.isSeededAdmin ? (
                        <div><span className={badgePending}>Rendszer-admin</span></div>
                      ) : null}
                    </td>
                    <td className={td}>{entry.email}</td>
                    <td className={td}>
                      <span className={code}>{entry.permissions.length} jogosultság</span>
                    </td>
                    <td className={td}>{formatDate(entry.createdAt)}</td>
                    <td className={td}>
                      <div className={actions}>
                        {canGrant ? (
                          <button className={iconButton} type="button" title="Jogosultságok" onClick={() => openGrants(entry)}>
                            <ShieldCheck className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                        {canManage ? (
                          <>
                            <button className={iconButton} type="button" title="Jelszó visszaállítása" onClick={() => void resetPassword(entry)}>
                              <KeyRound className="size-3.5" aria-hidden />
                            </button>
                            <button
                              className={iconButtonDanger}
                              type="button"
                              title="Törlés"
                              disabled={entry.isSeededAdmin || entry.id === currentId}
                              onClick={() => void remove(entry)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={formOpen}
        title="Új felhasználó"
        onClose={() => {
          setFormOpen(false);
          setDraft(emptyDraft);
          setFieldErrors({});
          setSubmitError(null);
        }}
      >
        <form className={form} onSubmit={submit} noValidate>
          {submitError ? <p className={formError}>{submitError}</p> : null}

          <label className={field}>
            <span>Név</span>
            <input className={input} value={draft.name} onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))} />
            {fieldErrors.name ? <p className={fieldError}>{fieldErrors.name}</p> : null}
          </label>

          <label className={field}>
            <span>E-mail</span>
            <input className={input} type="email" value={draft.email} onChange={(event) => setDraft((c) => ({ ...c, email: event.target.value }))} />
            {fieldErrors.email ? <p className={fieldError}>{fieldErrors.email}</p> : null}
          </label>

          <label className={field}>
            <span>Jelszó</span>
            <input className={input} type="password" value={draft.password} onChange={(event) => setDraft((c) => ({ ...c, password: event.target.value }))} />
            {fieldErrors.password ? <p className={fieldError}>{fieldErrors.password}</p> : null}
          </label>

          <div className={field}>
            <span>Jogosultságok</span>
            <PermissionPicker
              catalog={catalog}
              value={draft.permissions}
              onChange={(next) => setDraft((c) => ({ ...c, permissions: next }))}
            />
          </div>

          <button className={buttonPrimary} type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Felhasználó létrehozása
          </button>
        </form>
      </Dialog>

      <Dialog
        open={grantUser !== null}
        title={grantUser ? `Jogosultságok — ${grantUser.email}` : "Jogosultságok"}
        onClose={() => setGrantUser(null)}
      >
        <div className="flex flex-col gap-4">
          <p className={muted}>
            A fiók csak a kijelölt jogosultságokkal rendelkezik. A módosítás a következő kérésnél érvényes.
          </p>

          {grantError ? <p className={formError}>{grantError}</p> : null}

          <PermissionPicker
            catalog={catalog}
            value={[...grantSelection]}
            onChange={(next) => setGrantSelection(new Set(next))}
          />

          <button className={buttonPrimary} type="button" disabled={grantSaving || catalog === null} onClick={() => void saveGrants()}>
            {grantSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            Jogosultságok mentése
          </button>
        </div>
      </Dialog>
    </div>
  );
}
