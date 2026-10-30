import { useSearchParams } from "react-router-dom";
import { PageTemplate } from "../components";
import { RowList } from "../components/creator";
import { useNewsRows } from "../lib/news";
import { useLang } from "../i18n/languageContext";
import { useDocumentHead } from "../lib/useDocumentHead";

/** Compares case- and accent-insensitively (á → a). */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** /kereses?q=…: searches live and built-in posts by title and excerpt. */
export default function Search() {
  const { tr } = useLang();
  useDocumentHead({ title: tr("Keresés") });
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const rows = useNewsRows();
  const needle = fold(q.trim());
  const hits = needle ? rows.filter((r) => fold(`${r.title} ${r.excerpt ?? ""}`).includes(needle)) : [];

  return (
    <PageTemplate>
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <h1 className="font-display text-3xl font-bold">{tr("Keresés")}</h1>
        <input
          type="search"
          autoFocus
          value={q}
          placeholder={tr("Keresés a hírek között…")}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          className="mt-4 block w-full rounded-md border border-petrikline bg-petrikcard px-3 py-2 text-sm focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25"
        />
        {needle && <p className="mt-3 text-sm text-petriksoft">{hits.length} {tr("találat")}</p>}
      </div>
      {hits.length > 0 && <RowList variant="news" rows={hits} />}
    </PageTemplate>
  );
}
