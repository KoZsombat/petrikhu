import { createContext, useContext } from "react";
import type { MenuItem, PublicSite } from "../../shared/pnw/creator-types";
import type { DocLibrary } from "../../shared/pnw/page-types";

export type SiteContent = {
  /** A szerkesztő által kiadott oldalak, slug szerint; felülírják a beépítetteket. */
  pages: Map<string, PublicSite["pages"][number]>;
  /** A szerkesztett menü, vagy null: ilyenkor a beépített (constants.ts) él. */
  menu: MenuItem[] | null;
  /** A szerkesztett Dokumentumtár, vagy null: ilyenkor a beépített él. */
  library: DocLibrary | null;
  /** Addig igaz, amíg a lekérés tart: egy ismeretlen slugot ekkor még nem szabad 404-nek venni. */
  loading: boolean;
};

export const SiteContext = createContext<SiteContent>({ pages: new Map(), menu: null, library: null, loading: false });

export const useSiteContent = () => useContext(SiteContext);
