"use client";

import { SEED_CONCERTS, sanitizeConcert, type ConcertRec } from "@/features/concerts/data";
import { now as hlcNow } from "./hlc";

const KEY = "heard.concerts.v1";

/** Every write announces itself so derived pages (Wrapped, Songs, Map,
 *  Achievements) recompute instead of showing stale numbers. */
function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("heard-sync"));
}

// Debounced cloud pushes: typing in the journal shouldn't hit the network
// on every keystroke.
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
function schedulePush(c: ConcertRec) {
  const prev = pushTimers.get(c.id);
  if (prev) clearTimeout(prev);
  pushTimers.set(c.id, setTimeout(() => {
    pushTimers.delete(c.id);
    import("./sync").then((m) => m.pushConcert(c)).catch(() => {});
  }, 1500));
}

/** Local-first store: seed data + anything the user adds, persisted in
 *  localStorage. Swap this module for Supabase queries later without
 *  touching the pages. */
export function getConcerts(): ConcertRec[] {
  if (typeof window === "undefined") return SEED_CONCERTS;
  try {
    const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return [...added, ...SEED_CONCERTS].map(sanitizeConcert).sort(
      (a, b) => +new Date(b.dateDisplay) - +new Date(a.dateDisplay)
    );
  } catch {
    return SEED_CONCERTS;
  }
}

export function updateConcert(id: string, patch: Partial<ConcertRec>) {
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  const next = added.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now(), hlc: hlcNow() } : c));
  localStorage.setItem(KEY, JSON.stringify(next));
  announce();
  const changed = next.find((c) => c.id === id);
  if (changed) schedulePush(changed);
}

export function deleteConcert(id: string) {
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify(added.filter((c) => c.id !== id)));
  announce();
  import("./sync").then((m) => { m.markDeleted(id); m.removeConcertRemote(id); }).catch(() => {});
}

export function addConcert(c: ConcertRec) {
  const stamped = { ...c, updatedAt: Date.now(), hlc: hlcNow() };
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify([stamped, ...added]));
  announce();
  import("./sync").then((m) => m.pushConcert(stamped)).catch(() => {});
}

/** Import-scale writes: ONE localStorage write, ONE announce, chunked sync.
 *  (500 shows through addConcert would mean 500 rewrites + 500 upserts.) */
export function addConcertsBulk(list: ConcertRec[]) {
  if (!list.length) return;
  const stamped = list.map((c) => ({ ...c, updatedAt: Date.now(), hlc: hlcNow() }));
  const added: ConcertRec[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify([...stamped, ...added]));
  announce();
  import("./sync").then((m) => m.pushConcertsBulk(stamped)).catch(() => {});
}

export function daysUntil(dateDisplay: string): number | null {
  const d = new Date(dateDisplay);
  if (isNaN(+d)) return null;
  const diff = Math.ceil((+d - Date.now()) / 86400000);
  return diff > 0 ? diff : null;
}
