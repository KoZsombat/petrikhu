import { useI18n } from "../lib/i18n";

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();

  return (
    <span className="inline-flex overflow-hidden rounded-md border border-line" aria-label="Language">
      {(["hu", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          lang={code}
          className={
            lang === code
              ? "bg-tint px-2 py-1 text-[11px] font-semibold tracking-wide text-accent-dark"
              : "bg-transparent px-2 py-1 text-[11px] font-semibold tracking-wide text-faint"
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
