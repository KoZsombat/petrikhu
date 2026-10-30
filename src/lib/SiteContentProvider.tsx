import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { publicSite } from "./api";
import { SiteContext } from "./siteContext";
import type { SiteContent } from "./siteContext";

/** Fetches the Creator's changes once on load; on error, everything shows the built-in content. */
export default function SiteContentProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<Awaited<ReturnType<typeof publicSite>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicSite()
      .then(setSite)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<SiteContent>(
    () => ({
      pages: new Map((site?.pages ?? []).map((page) => [page.slug, page])),
      menu: site?.menu ?? null,
      library: site?.library ?? null,
      loading,
    }),
    [site, loading],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
