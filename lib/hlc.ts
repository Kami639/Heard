"use client";

/* Hybrid logical clock.
 *
 * Wall clocks on two phones can disagree by minutes, which makes "last write
 * wins" pick the wrong write. An HLC keeps physical time (so ordering still
 * matches reality) but adds a counter that only ever moves forward, plus a
 * node id to break exact ties deterministically. Every device converges on the
 * same answer regardless of clock skew.
 */

const NODE_KEY = "heard.node.v1";
let lastPhysical = 0;
let counter = 0;

function nodeId(): string {
  try {
    let id = localStorage.getItem(NODE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 8);
      localStorage.setItem(NODE_KEY, id);
    }
    return id;
  } catch {
    return "anon00";
  }
}

/** Sortable stamp: "000001718220000-0003-a1b2c3" */
export function now(): string {
  const physical = Date.now();
  if (physical > lastPhysical) {
    lastPhysical = physical;
    counter = 0;
  } else {
    counter++; // same millisecond, or clock went backwards
  }
  return `${String(lastPhysical).padStart(15, "0")}-${String(counter).padStart(4, "0")}-${nodeId()}`;
}

/** Fold in a stamp seen from another device so our clock never trails it. */
export function observe(remote?: string | null) {
  if (!remote) return;
  const [p, c] = remote.split("-");
  const physical = Number(p);
  if (!Number.isFinite(physical)) return;
  if (physical > lastPhysical) {
    lastPhysical = physical;
    counter = Number(c) || 0;
  } else if (physical === lastPhysical) {
    counter = Math.max(counter, Number(c) || 0);
  }
}

/** true when a is newer than b. Falls back to plain timestamps for old rows. */
export function isNewer(a?: string | null, b?: string | null): boolean {
  if (a && b) return a > b;
  return Boolean(a) && !b;
}
