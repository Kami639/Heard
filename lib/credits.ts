"use client";

import { getConcerts, updateConcert } from "./store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Shows where songs could be credited to the wrong artist: more than one act
 *  on the bill, and at least one song either unattributed or attributed to the
 *  whole billing string. */
export function needsCredits(cs: ConcertRec[]): ConcertRec[] {
  return cs.filter((c) => {
    const acts = c.artists?.length ? c.artists.map((a) => a.name) : splitArtists(c.artist);
    if (acts.length < 2) return false;
    if (c.creditsChecked) return false;
    return c.setlist.some((s) => {
      const who = c.songArtists?.[s];
      return !who || splitArtists(who).length > 1;
    });
  });
}

/** Re-credit one show. Returns how many songs changed. */
export async function fixConcertCredits(
  concert: ConcertRec,
  onProgress?: (done: number, total: number, song: string) => void
): Promise<number> {
  const acts = concert.artists?.length ? concert.artists.map((a) => a.name) : splitArtists(concert.artist);
  if (acts.length < 2) return 0;

  const songArtists: Record<string, string> = { ...(concert.songArtists ?? {}) };
  let changed = 0;

  for (let i = 0; i < concert.setlist.length; i++) {
    const song = concert.setlist[i];
    onProgress?.(i + 1, concert.setlist.length, song);

    const current = songArtists[song];
    // already credited to a single act on this bill? leave it alone
    if (current && splitArtists(current).length === 1 && acts.some((a) => norm(a) === norm(current))) continue;

    try {
      const r = await fetch(
        `/api/attribute?song=${encodeURIComponent(song)}&artists=${encodeURIComponent(acts.join("|"))}`
      );
      const d = await r.json();
      if (d.artist) {
        const label = d.credited?.length > 1 ? d.credited.join(" & ") : d.artist;
        if (label !== current) { songArtists[song] = label; changed++; }
      }
    } catch {}
  }

  updateConcert(concert.id, { songArtists, creditsChecked: true });
  return changed;
}

/** Fix every show that needs it. */
export async function fixAllCredits(
  onProgress?: (showIdx: number, shows: number, done: number, total: number) => void
): Promise<number> {
  const shows = needsCredits(getConcerts());
  let total = 0;
  for (let i = 0; i < shows.length; i++) {
    total += await fixConcertCredits(shows[i], (done, count) => onProgress?.(i + 1, shows.length, done, count));
  }
  return total;
}
