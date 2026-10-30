/** A post's date above the article, e.g. "2026. október 23." (Hungarian date format) */
export function formatPostDate(iso: string, lang: "hu" | "en" = "hu"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "hu-HU", { year: "numeric", month: "long", day: "numeric" });
}
