import { useEffect, useSyncExternalStore } from "react";
import type { Term, TermKind } from "../../shared/pnw/types";
import { SEED_CATEGORIES } from "../../shared/pnw/seed-terms";

/**
 * The live category and tag list. The server owns it, so every
 * screen (the Hírkezelő and the public post alike) reads the names from here.
 * One fetch per page load, cached at module level; until it
 * arrives (or when there is no backend), the baked-in categories are the snapshot.
 * Subscribers mean a new item appears immediately in every open list.
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
      /* no backend: the baked-in categories already have the right names */
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

/** All categories and tags. */
export function useTerms(): Term[] {
  const terms = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    load();
  }, []);
  return terms;
}

/** Adds a newly created item (api.createTerm) to the shared list. */
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

/** Display names of a post's categories/tags, in the post's own order. */
export function termNames(terms: Term[], ids: string[]): string[] {
  const byId = termMap(terms);
  return ids.map((id) => byId.get(id)?.name ?? id);
}
