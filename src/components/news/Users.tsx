import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import * as api from "../../lib/api";
import { ApiError } from "../../lib/api";
import type { AccountInput, ApiUser } from "../../lib/api";
import type { Capability } from "../../../shared/pnw/types";
import { ALL_CAPABILITIES, CAPABILITY_DESCRIPTION, CAPABILITY_LABEL } from "../../../shared/pnw/permissions";
import { btnCls, inputCls } from "../../pages/SchemaForm";
import { actionsCls, btnDanger, btnPrimary, btnSmall, card, emptyCls, labelCls, td, th } from "./ui";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "A felhasználónév és a név kötelező.",
  password_too_short: "A jelszó legalább 10 karakter legyen.",
  username_taken: "Ez a felhasználónév már foglalt.",
  cannot_delete_self: "A saját fiókodat nem törölheted.",
  last_manager: 'Ez az egyetlen fiók, ami fiókokat kezelhet - előbb adj valaki másnak "Fiókok kezelése" jogot.',
  not_found: "A fiók már nem létezik.",
};

const emptyForm = (): AccountInput => ({ username: "", displayName: "", password: "", permissions: [] });

/** Fiókkezelés: a fiók egy belépés és egy jogosultsághalmaz, szerepkörök nincsenek. */
export default function Users({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<AccountInput>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    setUsers((await api.listUsers()).users);
  }

  useEffect(() => {
    // Egyszeri lekérés betöltéskor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, []);

  function startCreate(): void {
    setForm(emptyForm());
    setEditingId(null);
    setCreating(true);
    setError(null);
  }

  function startEdit(user: ApiUser): void {
    setForm({ username: user.username ?? "", displayName: user.displayName, password: "", permissions: user.permissions });
    setEditingId(user.id);
    setCreating(false);
    setError(null);
  }

  function cancelForm(): void {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function submitForm(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editingId) await api.updateAccount(editingId, form);
      else await api.createAccount(form);
      await reload();
      cancelForm();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      setError(ERROR_MESSAGES[code] ?? "A mentés nem sikerült.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: ApiUser): Promise<void> {
    if (!window.confirm(`Biztosan törlöd ezt a fiókot: ${user.displayName}?`)) return;
    try {
      await api.deleteAccount(user.id);
      await reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "save_error";
      window.alert(ERROR_MESSAGES[code] ?? "A törlés nem sikerült.");
    }
  }

  function togglePermission(capability: Capability, checked: boolean): void {
    setForm({ ...form, permissions: checked ? [...form.permissions, capability] : form.permissions.filter((existing) => existing !== capability) });
  }

  const formOpen = creating || editingId !== null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Hírkezelő felhasználók</h1>
          <p className="text-sm text-petriksoft">Fiókok létrehozása, módosítása, törlése - és jogosultságonként az, hogy ki mit tehet.</p>
        </div>
        {!formOpen && (
          <button type="button" className={btnPrimary} onClick={startCreate}>
            + Új fiók
          </button>
        )}
      </div>

      {formOpen && (
        <form className={`${card} flex flex-col gap-4`} onSubmit={submitForm}>
          {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <label className={labelCls}>
            Név <span className="text-red-600">*</span>
            <input type="text" required className={inputCls} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          </label>
          <label className={labelCls}>
            Felhasználónév <span className="text-red-600">*</span>
            <input type="text" required className={inputCls} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label className={labelCls}>
            {editingId ? "Új jelszó" : "Jelszó"} {!editingId && <span className="text-red-600">*</span>}
            <input
              type="text"
              required={!editingId}
              className={inputCls}
              placeholder={editingId ? "Üresen hagyva a jelenlegi jelszó marad" : undefined}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <small className="mt-1 block text-xs text-petrikfaint">Legalább 10 karakter.</small>
          </label>

          <fieldset className="rounded-lg border border-petrikline p-4">
            <legend className="px-1 text-sm font-medium text-petriksoft">Jogosultságok</legend>
            <small className="mb-3 block text-xs text-petrikfaint">
              Jogosultság nélkül a fiók be tud jelentkezni, de egyetlen felületet sem ér el. Kategóriát és címkét minden fiók használhat - külön jog csak újak létrehozásához kell.
            </small>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALL_CAPABILITIES.map((capability) => (
                <label key={capability} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-petrikaccent" checked={form.permissions.includes(capability)} onChange={(event) => togglePermission(capability, event.target.checked)} />
                  <span>
                    <strong className="block">{CAPABILITY_LABEL[capability]}</strong>
                    <small className="text-xs text-petriksoft">{CAPABILITY_DESCRIPTION[capability]}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button type="button" className={btnCls} onClick={cancelForm}>
              Mégse
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {editingId ? "Mentés" : "Létrehozás"}
            </button>
          </div>
        </form>
      )}

      <div className={`${card} overflow-x-auto`}>
        {!users ? (
          <div className={emptyCls}>Betöltés…</div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Név</th>
                <th className={th}>Felhasználónév</th>
                <th className={th}>Jogosultságok</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className={td}>
                    <strong>{user.displayName}</strong>
                    {user.id === currentUserId && <small className="ml-1 text-xs text-petrikfaint">(te)</small>}
                  </td>
                  <td className={td}>{user.username}</td>
                  <td className={td}>
                    {user.permissions.length === 0 ? (
                      <small className="text-xs text-petrikfaint">Nincs jogosultság</small>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {ALL_CAPABILITIES.filter((capability) => user.permissions.includes(capability)).map((capability) => (
                          <span key={capability} className="rounded-full bg-petriktint px-2 py-0.5 text-xs text-petrikaccentdark">
                            {CAPABILITY_LABEL[capability]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <div className={actionsCls}>
                      <button type="button" className={`${btnPrimary} ${btnSmall}`} onClick={() => startEdit(user)}>
                        Szerkesztés
                      </button>
                      <button
                        type="button"
                        className={`${btnDanger} ${btnSmall}`}
                        onClick={() => remove(user)}
                        disabled={user.id === currentUserId}
                        title={user.id === currentUserId ? "A saját fiókodat nem törölheted" : undefined}
                      >
                        Törlés
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
