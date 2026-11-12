/** Shared Tailwind recipes used by the admin components. No component CSS lives in a stylesheet. */
export const page = "flex flex-col gap-6";
export const pageTitle = "font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]";
export const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-dark";
export const muted = "text-[12.5px] text-faint";
export const code = "text-xs text-faint";
export const empty = "py-7 text-center text-[13.5px] text-faint";

export const panel = "rounded-xl border border-line-soft bg-surface p-5";
export const panelTitle = "mb-4 font-display text-xl font-semibold tracking-[-0.01em]";

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";
export const button = `${buttonBase} border-line bg-surface text-ink hover:border-accent hover:bg-tint`;
export const buttonPrimary = `${buttonBase} border-accent bg-accent text-white hover:bg-accent-dark`;
export const buttonDanger = `${buttonBase} border-line bg-surface text-[#b42318] hover:border-[#b42318] hover:bg-[#fdf4f2]`;
export const buttonBlock = "w-full py-2.5";
export const iconButton =
  "inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-soft transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
export const iconButtonDanger = `${iconButton} hover:border-[#b42318] hover:text-[#b42318]`;

export const input =
  "w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";
export const textarea = `${input} resize-y`;
export const select = input;
export const field = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-soft";
export const fieldError = "text-xs font-medium text-[#b42318]";
export const formError =
  "rounded-lg border border-[#f0d3ce] bg-[#fdf4f2] px-3 py-2 text-[13px] text-[#b42318]";
export const checkbox = "flex items-center gap-2 text-[13.5px] text-soft accent-accent";

export const badge =
  "inline-block rounded-full border border-line-soft bg-cream px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-soft";
export const badgeLive = `${badge} border-accent/35 bg-tint text-accent-dark`;
export const badgePending = `${badge} border-[#8a5a00]/25 bg-[#fbf3e0] text-[#8a5a00]`;

export const tableWrap = "overflow-x-auto rounded-xl border border-line-soft bg-surface";
export const table = "w-full border-collapse text-[13.5px]";
export const th =
  "whitespace-nowrap border-b border-line-soft bg-tint px-3.5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint";
export const td = "border-b border-line-soft px-3.5 py-3 align-top";
export const actions = "flex justify-end gap-1.5";

export const form = "flex flex-col gap-3.5";
export const formRow = "grid grid-cols-1 gap-3 sm:grid-cols-2";
