/** Egy hír dátuma a cikk fölött: "2026. október 23." */
export function formatPostDate(iso: string, lang: "hu" | "en" = "hu"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "hu-HU", { year: "numeric", month: "long", day: "numeric" });
}
