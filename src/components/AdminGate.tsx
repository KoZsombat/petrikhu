import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CAPABILITY } from "../../shared/pnw/types";
import { ApiError } from "../lib/api";
import type { ApiUser } from "../lib/api";
import { useSession } from "../lib/useSession";
import { useDocumentHead } from "../lib/useDocumentHead";
import Logo from "../assets/logo_nagy_ed8ce51ced.png";
import { btnCls, inputCls } from "../pages/SchemaForm";

const MESSAGES: Record<string, string> = {
  empty_fields: "Add meg a felhasználóneved és a jelszavad.",
  invalid_credentials: "A megadott felhasználónév vagy jelszó nem megfelelő.",
  no_access: "Ezzel a felhasználóval nincs jogosultság a szerkesztő használatához.",
  too_many_attempts: "Túl sok sikertelen próbálkozás. Próbáld újra 15 perc múlva.",
};

function LoginCard({ onLogin }: { onLogin: (login: string, password: string) => Promise<void> }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(login, password);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "";
      setError(MESSAGES[code] ?? "A bejelentkezés nem sikerült.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 flex max-w-sm flex-col gap-3 rounded-lg border border-petrikline bg-petrikcard p-6">
      <img src={Logo} alt="Petrik" className="h-10 w-auto self-start" />
      <h1 className="font-display text-2xl font-bold">Bejelentkezés</h1>
      <p className="text-sm text-petriksoft">A felületet azok használhatják, akiknek a fiókján van szerkesztési jogosultság.</p>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <label className="text-sm font-medium text-petriksoft">
        Felhasználónév
        <input className={inputCls} autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
      </label>
      <label className="text-sm font-medium text-petriksoft">
        Jelszó
        <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button type="submit" disabled={busy} className="rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard hover:bg-petrikaccentdark disabled:opacity-60">
        {busy ? "Bejelentkezés…" : "Bejelentkezés"}
      </button>
    </form>
  );
}

type GateProps = {
  children: (user: ApiUser, logout: () => Promise<void>) => ReactNode;
  /** Who may enter; by default the page-editing permission (MANAGE_PAGES). Hírkezelő: any news permission. */
  allow?: (user: ApiUser) => boolean;
  /** Text of the access-denied screen. */
  deniedText?: string;
};

const canManagePages = (user: ApiUser) => user.permissions.includes(CAPABILITY.MANAGE_PAGES);

/** Gate for the editor screens (Creator, Dashboard, Hírkezelő): login, then the permission check. */
export default function AdminGate({
  children,
  allow = canManagePages,
  deniedText = "Ehhez a felülethez nincs jogosultságod (Oldalak szerkesztése).",
}: GateProps) {
  const { user, loading, login, logout } = useSession();
  useDocumentHead({ title: "Szerkesztő", noindex: true });
  return (
    <div className="min-h-screen bg-petrikbg font-body text-petrikink">
      {loading ? null : !user ? (
        <LoginCard onLogin={login} />
      ) : !allow(user) ? (
        <div className="mx-auto mt-24 max-w-sm rounded-lg border border-petrikline bg-petrikcard p-6">
          <p className="text-sm">{deniedText}</p>
          <button type="button" className={`mt-4 ${btnCls}`} onClick={logout}>
            Kijelentkezés
          </button>
        </div>
      ) : (
        children(user, logout)
      )}
    </div>
  );
}
