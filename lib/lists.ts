"use client";

/* Self-curated lists — the Letterboxd mechanic. "Best encores I've seen",
 * "festival sets I'll never forget", a bucket list. Kept local and simple. */

export interface ConcertList {
  id: string;
  name: string;
  note?: string;
  concertIds: string[];
  created: number;
}

const KEY = "heard.lists.v1";

function save(lists: ConcertList[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lists)); } catch {}
  window.dispatchEvent(new Event("heard-sync"));
}

export function getLists(): ConcertList[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function createList(name: string, note?: string): ConcertList {
  const list: ConcertList = {
    id: `list-${Date.now()}`, name: name.trim(), note, concertIds: [], created: Date.now(),
  };
  save([list, ...getLists()]);
  return list;
}

export function renameList(id: string, name: string) {
  save(getLists().map((l) => (l.id === id ? { ...l, name } : l)));
}

export function deleteList(id: string) {
  save(getLists().filter((l) => l.id !== id));
}

export function toggleInList(listId: string, concertId: string) {
  save(getLists().map((l) => {
    if (l.id !== listId) return l;
    const has = l.concertIds.includes(concertId);
    return { ...l, concertIds: has ? l.concertIds.filter((c) => c !== concertId) : [...l.concertIds, concertId] };
  }));
}

export const listsWith = (concertId: string) =>
  getLists().filter((l) => l.concertIds.includes(concertId));
