/** Dates as the site shows them, always in Budapest time. */
const TIME_ZONE = "Europe/Budapest";

const MONTHS = {
  hu: ["JAN.", "FEBR.", "MÁRC.", "ÁPR.", "MÁJ.", "JÚN.", "JÚL.", "AUG.", "SZEPT.", "OKT.", "NOV.", "DEC."],
  en: ["JAN.", "FEB.", "MAR.", "APR.", "MAY", "JUN.", "JUL.", "AUG.", "SEP.", "OCT.", "NOV.", "DEC."],
};

function parts(iso: string): { year: number; month: number; day: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

/** `SZEPT. 21.` — the date tag on cards and news rows. */
export function dateTag(iso: string, locale: "hu" | "en" = "hu"): string {
  const p = parts(iso);
  if (!p) return "";
  return locale === "en" ? `${MONTHS.en[p.month - 1]} ${p.day}` : `${MONTHS.hu[p.month - 1]} ${p.day}.`;
}

/** `2026. október 23.` — above an article. */
export function longDate(iso: string, locale: "hu" | "en" = "hu"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "hu-HU", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** YouTube video id of a watch/short/embed URL, or null for anything else. */
export function youtubeId(url: string): string | null {
  const match = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match?.[1] ?? null;
}
