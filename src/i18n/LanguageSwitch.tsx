import { useLang } from "./languageContext";

/** HU | EN váltó; a kiválasztott nyelv kiemelve. */
export default function LanguageSwitch({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const { lang, setLang } = useLang();
  const btn = (code: "hu" | "en", label: string) => (
    <button
      type="button"
      lang={code}
      aria-pressed={lang === code}
      aria-label={code === "hu" ? "Magyar" : "English"}
      onClick={() => setLang(code)}
      className={`px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider transition-colors ${tone === "light" ? (lang === code ? "font-semibold text-petrikaccentdark" : "text-black/50 hover:text-black") : lang === code ? "text-white" : "text-petriklink/60 hover:text-white"}`}
    >
      {label}
    </button>
  );
  return (
    <span className={`inline-flex items-center divide-x ${tone === "light" ? "divide-black/20" : "divide-petriklink/30"} ${className}`}>
      {btn("hu", "HU")}
      {btn("en", "EN")}
    </span>
  );
}
