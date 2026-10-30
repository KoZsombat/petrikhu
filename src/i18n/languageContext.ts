import { createContext, useContext } from "react";

export type Lang = "hu" | "en";

export type LanguageValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Magyar felirat → az aktuális nyelven (a szótár: src/i18n/en.ts). */
  tr: (hu: string) => string;
};

export const LanguageContext = createContext<LanguageValue>({ lang: "hu", setLang: () => {}, tr: (hu) => hu });

export const useLang = () => useContext(LanguageContext);
