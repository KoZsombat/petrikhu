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
    // privát módban a tárolás nem elérhető: marad az alapnyelv
  }
  return "hu";
}

/** A weboldal nyelve (magyar / angol): a választást a böngésző megjegyzi, a <html lang> követi. */
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
          // lásd fent
        }
      },
      /** Magyar felirat → az aktuális nyelven; ismeretlen szöveg magyarul marad. */
      tr: (hu: string) => (lang === "en" ? (en[hu] ?? hu) : hu),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
