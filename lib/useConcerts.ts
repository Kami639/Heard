"use client";

import { useSyncExternalStore } from "react";
import { getConcerts } from "./store";
import type { ConcertRec } from "@/features/concerts/data";

/* One subscription for the whole app.
 *
 * Pages used to each wire up their own useEffect + "heard-sync" listener, which
 * is how Wrapped ended up showing stale numbers. useSyncExternalStore is the
 * React-sanctioned way to read an external store: every component re-renders
 * the moment the data changes, and the snapshot is cached so React's identity
 * checks don't loop.
 */

let snapshot: ConcertRec[] = [];
let version = -1;
let dataVersion = 0;

function bumpVersion() {
  dataVersion++;
}

/* CRITICAL: invalidation must NOT depend on a component being subscribed.
 * Writes can happen from pages that read the store directly (the concert
 * detail page edits setlists, crew, ratings without useConcerts). If only
 * subscribers bumped the version, those writes would leave this cache
 * "valid" and the next page to mount — the archive — would render a stale
 * list until a hard refresh. One module-level listener fixes the class. */
if (typeof window !== "undefined") {
  window.addEventListener("heard-sync", bumpVersion);
  window.addEventListener("storage", bumpVersion);
}

function subscribe(onChange: () => void) {
  const handler = () => onChange(); // version bump handled globally above
  window.addEventListener("heard-sync", handler);
  window.addEventListener("storage", handler); // other tabs
  return () => {
    window.removeEventListener("heard-sync", handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot(): ConcertRec[] {
  if (version !== dataVersion) {
    snapshot = getConcerts();
    version = dataVersion;
  }
  return snapshot;
}

const EMPTY: ConcertRec[] = [];
const getServerSnapshot = () => EMPTY;

/** Live list of concerts. Re-renders automatically on any write, anywhere. */
export function useConcerts(): ConcertRec[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
