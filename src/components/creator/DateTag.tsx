import { cx } from "./utils";

export type DateTagProps = { date: string; className?: string };

/** Zöld, nagybetűs mono dátum-címke (kártyákon és hírsorokon). */
export function DateTag({ date, className }: DateTagProps) {
  return (
    <span
      className={cx(
        "inline-block rounded-sm bg-petrikaccent px-2 py-1 font-mono text-[11px] uppercase leading-none tracking-[0.06em] text-petrikcard",
        className,
      )}
    >
      {date}
    </span>
  );
}
