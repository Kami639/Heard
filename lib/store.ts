"use client";

import { SEED_CONCERTS, type ConcertRec } from "@/features/concerts/data";

const KEY = "heard.concerts.v1";

/** Local-first store: seed data + anything the user adds, persisted in
 *  localStorage. Swap this module for Supabase queries later without
 *  touching the pages. */
export function getConcerts(): ConcertRec[] {
  if (typeof window === "undefined") return SEED_CONCERTS;
  try {
    const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return [...added, ...SEED_CONCERTS].sort(
      (a, b) => +new Date(b.dateDisplay) - +new Date(a.dateDisplay)
    );
  } catch {
    return SEED_CONCERTS;
  }
}

export function updateConcert(id: string, patch: Partial<ConcertRec>) {
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  const next = added.map((c) => (c.id === id ? { ...c, ...patch } : c));
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function deleteConcert(id: string) {
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify(added.filter((c) => c.id !== id)));
}

export function addConcert(c: ConcertRec) {
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify([c, ...added]));
}
