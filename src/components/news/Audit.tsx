import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import type { AuditEntry } from "../../../shared/pnw/types";
import { useUsers } from "../../lib/useUsers";
import AuditTable from "./AuditTable";
import { card, emptyCls } from "./ui";

/** A teljes hírkezelési napló (legutóbbi 100 esemény; az importálások külön kapcsolóval). */
export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [postTitles, setPostTitles] = useState<Map<string, string>>(new Map());
  const authors = useUsers();
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.fullAuditLog(100, imported).then(async ({ entries }) => {
      if (cancelled) return;
      setEntries(entries);

      const ids = Array.from(new Set(entries.map((entry) => entry.postId)));
      const titles = new Map<string, string>();
      await Promise.all(
        ids.map(async (id) => {
          try {
            const { post } = await api.getPost(id);
            titles.set(id, post.title || "(Névtelen hír)");
          } catch {
            // A lomtárba tett hír teljesen törlődik: ott az azonosító látszik.
          }
        }),
      );
      if (!cancelled) setPostTitles(titles);
    });

    return () => {
      cancelled = true;
    };
  }, [imported]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Hírkezelési napló</h1>
        <p className="mt-1 text-sm text-petriksoft">A legutóbbi 100 workflow-esemény, legújabb elöl.</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-petriksoft">
          <input type="checkbox" checked={imported} onChange={(event) => setImported(event.target.checked)} />
          Az importálások mutatása (a régi oldalról átvett hírek bejegyzései)
        </label>
      </div>
      <div className={`${card} p-0!`}>{!entries ? <div className={emptyCls}>Betöltés…</div> : <AuditTable entries={entries} authors={authors} postTitles={postTitles} />}</div>
    </section>
  );
}
