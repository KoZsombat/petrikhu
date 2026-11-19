/**
 * The school opened on 7 December 1879. Values on the public site count completed
 * anniversaries in the school's timezone, not the server's.
 */
const FOUNDING_YEAR = 1879;
const FOUNDING_MMDD = 12_07;

export function yearsSinceFounding(now = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Budapest",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  const years = Number(parts.year) - FOUNDING_YEAR;
  return Number(parts.month) * 100 + Number(parts.day) < FOUNDING_MMDD
    ? years - 1
    : years;
}
