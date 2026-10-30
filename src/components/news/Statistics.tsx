import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import type { Statistics as StatisticsData } from "../../lib/api";
import { useUsers } from "../../lib/useUsers";
import { termMap, useTerms } from "../../lib/terms";
import { card, emptyCls } from "./ui";

const MONTH_LABEL = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short" });

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} perc`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} óra`;
  return `${(seconds / 86400).toFixed(1)} nap`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** A Hírkezelő használatának és a publikált tartalmaknak az áttekintése. */
export default function Statistics() {
  const [data, setData] = useState<StatisticsData | null>(null);
  const authors = useUsers();
  const categoryNames = termMap(useTerms());

  useEffect(() => {
    api.statistics().then(setData);
  }, []);

  if (!data) return <div className={emptyCls}>Betöltés…</div>;

  const maxMonth = Math.max(1, ...data.monthlyChart.map((month) => month.count));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Statisztika</h1>
        <p className="text-sm text-petriksoft">Áttekintés a Hírkezelő használatáról és a publikált tartalmakról.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric value={data.liveAll} label="Kint lévő hírek" description="Az összes jelenleg publikus hír" />
        <Metric value={data.liveManaged} label="Hírkezelőből publikált" description="A workflow-val létrehozott és jelenleg élő hírek" />
        <Metric value={data.scheduled} label="Időzített" description="Jóváhagyva, későbbi megjelenésre vár" />
        <Metric value={data.pending} label="Jóváhagyásra vár" description="Vezetői döntésre váró hírek" />
        <Metric value={data.archived} label="Archívumban" description="Nem publikus, visszaállítható hírek" />
        <Metric value={data.monthPublished} label="Ebben a hónapban" description="Hírkezelőből publikált hírek" />
        <Metric value={formatDuration(data.averageApprovalSeconds)} label="Átlagos jóváhagyási idő" description="Beküldéstől a jóváhagyásig / időzítésig" />
      </div>

      <div className={card}>
        <h2 className="font-display text-xl font-bold">Publikálások az elmúlt 6 hónapban</h2>
        <p className="mb-4 text-sm text-petriksoft">A Hírkezelőből publikált hírek havi alakulása.</p>
        <div className="flex h-44 items-end gap-3">
          {data.monthlyChart.map((month) => (
            <div key={month.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <strong className="text-sm">{month.count}</strong>
              <div className="flex w-full flex-1 items-end rounded-md bg-petriktint">
                <span className="block w-full rounded-md bg-petrikaccent" style={{ height: `${Math.max(5, Math.round((month.count / maxMonth) * 100))}%` }} />
              </div>
              <small className="text-xs text-petrikfaint">{monthLabel(month.key)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Ranking title="Legaktívabb beküldők" text="Publikált, időzített vagy archivált workflow-hírek alapján." rows={data.topAuthors.map((row) => ({ key: row.key, name: authors.get(row.key)?.displayName ?? "Ismeretlen felhasználó", count: row.count }))} />
        <Ranking title="Leggyakoribb kategóriák" text="Milyen témákban készül a legtöbb workflow-hír." rows={data.topCategories.map((row) => ({ key: row.key, name: categoryNames.get(row.key)?.name ?? row.key, count: row.count }))} />
      </div>
    </section>
  );
}

function Metric({ value, label, description }: { value: number | string; label: string; description: string }) {
  return (
    <div className={`${card} flex flex-col gap-1 p-4!`}>
      <strong className="font-display text-3xl">{value}</strong>
      <span className="text-sm font-semibold">{label}</span>
      <small className="text-xs text-petrikfaint">{description}</small>
    </div>
  );
}

function Ranking({ title, text, rows }: { title: string; text: string; rows: { key: string; name: string; count: number }[] }) {
  return (
    <div className={card}>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mb-3 text-sm text-petriksoft">{text}</p>
      {rows.length === 0 ? (
        <div className={emptyCls}>Még nincs elegendő adat.</div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between border-t border-petriklinesoft py-2 text-sm first:border-t-0">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
