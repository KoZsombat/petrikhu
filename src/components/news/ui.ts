import { statusCssClass } from "../../../shared/pnw/statuses";

/** Shared Hírkezelő classes (aligned with the Dashboard `card` style). */
export const card = "rounded-lg border border-petrikline bg-petrikcard p-5";
export const kicker = "font-mono text-xs uppercase tracking-[0.25em] text-petrikaccentdark";
export const labelCls = "block text-sm font-medium text-petriksoft";
export const hintCls = "mt-1 block text-xs text-petrikfaint";
export const emptyCls = "rounded-md bg-petriktint px-3 py-3 text-sm text-petriksoft";
export const btnPrimary =
  "inline-block rounded-md bg-petrikaccent px-4 py-2 text-sm font-semibold text-petrikcard transition-colors hover:bg-petrikaccentdark disabled:opacity-60";
export const btnSmall = "px-2.5 py-1 text-xs";
export const btnDanger =
  "inline-block rounded-md border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-60";
export const th = "px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-petrikfaint";
export const td = "border-t border-petriklinesoft px-4 py-4 align-top";
/** Short, non-wrapping cell (date, source). */
export const tdNowrap = `${td} whitespace-nowrap`;
/** Action buttons that stay on one line in the table's last cell. */
export const actionsCls = "flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap";

/** Status colour: the statusCssClass() value → badge / dot. */
const BADGE: Record<string, string> = {
  draft: "bg-petriktint text-petriksoft",
  pending: "bg-amber-100 text-amber-800",
  pnw_revision: "bg-red-100 text-red-700",
  publish: "bg-emerald-100 text-emerald-800",
  future: "bg-sky-100 text-sky-800",
  other: "bg-petriktint text-petriksoft",
};
const DOT: Record<string, string> = {
  draft: "bg-petrikfaint",
  pending: "bg-amber-500",
  pnw_revision: "bg-red-500",
  publish: "bg-emerald-500",
  future: "bg-sky-500",
  other: "bg-petrikfaint",
};

export const badgeCls = (status: string) =>
  `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[statusCssClass(status)] ?? BADGE.other}`;
export const dotCls = (status: string) => `inline-block size-2.5 rounded-full ${DOT[statusCssClass(status)] ?? DOT.other}`;

export const noticeCls = {
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
} as const;
