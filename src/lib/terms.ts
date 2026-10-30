import { useEffect, useSyncExternalStore } from "react";
import type { Term, TermKind } from "../../shared/pnw/types";
import { SEED_CATEGORIES } from "../../shared/pnw/seed-terms";

/**
 * Az élő kategória- és címkelista. A szerver birtokolja őket, ezért minden
 * képernyő (a Hírkezelő és a nyilvános hír is) innen olvassa a neveket.
 * Oldalbetöltésenként egy lekérés, modulszinten gyorsítótárazva; amíg nem
 * érkezik meg (vagy ha nincs backend), a magolt kategóriák a pillanatkép.
 * Az előfizetők miatt egy új elem azonnal megjelenik minden nyitott listában.
 */
let snapshot: Term[] = SEED_CATEGORIES;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Term[]): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function load(): Promise<void> {
  inflight ??= fetch("/api/terms")
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("terms_unavailable"))))
    .then((data: { terms?: Term[] }) => {
      if (data.terms) publish(data.terms);
    })
    .catch(() => {
      /* nincs backend: a magolt kategóriák így is a jó nevek */
    });
  return inflight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Minden kategória és címke. */
export function useTerms(): Term[] {
  const terms = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    load();
  }, []);
  return terms;
}

/** Egy frissen létrehozott elem (api.createTerm) beemelése a közös listába. */
export function rememberTerm(term: Term): void {
  if (snapshot.some((existing) => existing.id === term.id)) return;
  publish([...snapshot, term]);
}

export function termsOfKind(terms: Term[], kind: TermKind): Term[] {
  return terms.filter((term) => term.kind === kind).sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

export function termMap(terms: Term[]): Map<string, Term> {
  return new Map(terms.map((term) => [term.id, term]));
}

/** Egy hír kategóriáinak/címkéinek megjelenített nevei, a hír saját sorrendjében. */
export function termNames(terms: Term[], ids: string[]): string[] {
  const byId = termMap(terms);
  return ids.map((id) => byId.get(id)?.name ?? id);
}
