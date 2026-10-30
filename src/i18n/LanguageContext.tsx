import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LanguageContext } from "./languageContext";
import type { Lang } from "./languageContext";
import { en } from "./en";

const STORAGE_KEY = "petrik:lang";

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "hu" || stored === "en") return stored;
  } catch {
    // in private mode storage is unavailable, so the default language stays
  }
  return "hu";
}

/** Site language (Hungarian / English): the browser remembers the choice, and <html lang> follows it. */
const reported = new Set<string>();

/** An untranslated label stays Hungarian; in development it is also reported once, so gaps are visible. */
function missing(hu: string): string {
  if (import.meta.env.DEV && !reported.has(hu)) {
    reported.add(hu);
    console.warn(`[i18n] missing English translation: ${JSON.stringify(hu)} (src/i18n/en.ts)`);
  }
  return hu;
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang: (next: Lang) => {
        setLangState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // see above
        }
      },
      /** Hungarian label → in the current language; unknown text stays Hungarian. */
      tr: (hu: string) => (lang === "en" ? (en[hu] ?? missing(hu)) : hu),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
