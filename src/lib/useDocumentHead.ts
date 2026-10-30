import { useEffect } from "react";
import { useLang } from "../i18n/languageContext";

const SITE = "Petrik Lajos Két Tanítási Nyelvű Technikum";

/** Beállítja az oldal címét és leírását; a `noindex` a szerkesztő felületeknek kell. */
export function useDocumentHead({ title, description, noindex }: { title?: string; description?: string; noindex?: boolean }) {
  const { tr } = useLang();
  useEffect(() => {
    const site = tr(SITE);
    // Régi oldali sablon: "Oldalcím | petrik.hu"; a kezdőlapé az iskola neve.
    document.title = title ? `${title} | petrik.hu` : site;

    const set = (name: string, content: string | undefined) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!content) return tag?.remove();
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    set("description", description);
    set("robots", noindex ? "noindex, nofollow" : undefined);
  }, [title, description, noindex, tr]);
}
