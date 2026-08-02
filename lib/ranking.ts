"use client";

/* Pairwise ranking.
 *
 * Asking "was this better than that?" produces a truer ordering than asking
 * for a number, because nobody can hold a consistent 1-10 scale across years
 * of shows. Each answer is a binary-search step, so ranking a new show takes
 * only a handful of comparisons. */

const KEY = "heard.ranked.v1";

export function getRanking(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

function save(order: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(order)); } catch {}
  window.dispatchEvent(new Event("heard-sync"));
}

export function rankOf(id: string): number | null {
  const i = getRanking().indexOf(id);
  return i < 0 ? null : i + 1;
}

export interface RankSession {
  id: string;
  lo: number;
  hi: number;
}

/** Start placing a show; returns the first comparison to ask about. */
export function beginRanking(id: string): { session: RankSession; against: string | null } {
  const order = getRanking().filter((x) => x !== id);
  const session = { id, lo: 0, hi: order.length };
  return { session, against: order.length ? order[Math.floor(order.length / 2)] : null };
}

/** Answer one comparison. Returns the next question, or null when placed. */
export function answer(session: RankSession, better: boolean): { session: RankSession; against: string | null } {
  const order = getRanking().filter((x) => x !== session.id);
  const mid = Math.floor((session.lo + session.hi) / 2);
  const next = better ? { ...session, hi: mid } : { ...session, lo: mid + 1 };

  if (next.lo >= next.hi) {
    order.splice(next.lo, 0, session.id);
    save(order);
    return { session: next, against: null };
  }
  return { session: next, against: order[Math.floor((next.lo + next.hi) / 2)] };
}

export function removeFromRanking(id: string) {
  save(getRanking().filter((x) => x !== id));
}
