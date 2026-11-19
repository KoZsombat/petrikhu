import { Loader2, Save } from "lucide-react";
import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { getSiteSettings, updateSiteSettings } from "../lib/api";
import { usePermissions } from "../lib/permissions";
import {
  buttonPrimary,
  eyebrow,
  field,
  form,
  formError,
  input,
  page,
  pageTitle,
  panel,
  panelTitle,
} from "../lib/ui";

export function SettingsPage() {
  const permissions = usePermissions();
  const canManage = permissions.has("settings.manage");

  const [students, setStudents] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    void getSiteSettings()
      .then((settings) => {
        if (active) setStudents(settings.students);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Betöltési hiba");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const settings = await updateSiteSettings({ students });
      setStudents(settings.students);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mentési hiba");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={page}>
      <header>
        <span className={eyebrow}>Intézmény</span>
        <h1 className={`mt-1 ${pageTitle}`}>Beállítások</h1>
        <p className="mt-1.5 text-[14.5px] text-soft">
          A nyilvános oldal statisztikáiban megjelenő értékek.
        </p>
      </header>

      {error ? <p className={formError}>{error}</p> : null}

      <section className={`${panel} max-w-2xl`}>
        <h2 className={panelTitle}>Iskola adatai</h2>

        {!canManage ? (
          <p className="text-[13.5px] text-faint">
            A beállítások szerkesztéséhez Beállítások kezelése jogosultság szükséges.
          </p>
        ) : loading ? (
          <p className="text-[13.5px] text-faint">
            <Loader2 className="mr-1 inline size-4 animate-spin" /> Betöltés…
          </p>
        ) : (
          <form className={form} onSubmit={save}>
            <label className={field}>
              Diákok száma
              <input
                className={input}
                value={students}
                onChange={(event) => {
                  setStudents(event.target.value);
                  setSaved(false);
                }}
                maxLength={32}
                required
              />
            </label>
            <p className="text-[12.5px] text-faint">
              Ez a szöveg jelenik meg a kezdőlapon és a bemutatkozás oldalon. Számot írj be, ha
              szeretnéd, hogy felszámlálással jelenjen meg.
            </p>

            <div className="flex items-center gap-3">
              <button className={buttonPrimary} type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                Beállítások mentése
              </button>
              {saved ? <span className="text-[13px] text-accent-dark">Mentve.</span> : null}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
