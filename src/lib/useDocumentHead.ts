import { useEffect } from "react";
import { useLang } from "../i18n/languageContext";

const SITE = "Petrik Lajos Két Tanítási Nyelvű Technikum";

/** Sets the page title and description; the editor screens need `noindex`. */
export function useDocumentHead({ title, description, noindex }: { title?: string; description?: string; noindex?: boolean }) {
  const { tr } = useLang();
  useEffect(() => {
    const site = tr(SITE);
    // Old-site template: "Page title | petrik.hu"; the home page uses the school name.
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
