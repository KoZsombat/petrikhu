import { createContext, useContext } from "react";
import type { MenuItem, PublicSite } from "../../shared/pnw/creator-types";
import type { DocLibrary } from "../../shared/pnw/page-types";

export type SiteContent = {
  /** Pages published by the Creator, by slug; they override the built-in ones. */
  pages: Map<string, PublicSite["pages"][number]>;
  /** The edited menu, or null: the built-in one (constants.ts) applies then. */
  menu: MenuItem[] | null;
  /** The edited Dokumentumtár, or null: the built-in one applies then. */
  library: DocLibrary | null;
  /** True while the fetch is in progress: an unknown slug must not yet be treated as a 404. */
  loading: boolean;
};

export const SiteContext = createContext<SiteContent>({ pages: new Map(), menu: null, library: null, loading: false });

export const useSiteContent = () => useContext(SiteContext);
