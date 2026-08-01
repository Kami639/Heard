"use client";

import { getConcerts, updateConcert } from "./store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Everyone who might have performed at a show. Crucially this includes the
 *  tour's co-headliners: setlist.fm often files only the headliner's setlist,
 *  so a co-headline night looks like a solo show until we ask Wikipedia who
 *  else was on that tour. */
export async function candidateActs(c: ConcertRec): Promise<string[]> {
  const set = new Set<string>();
  for (const a of c.artists ?? []) set.add(a.name);
  for (const a of splitArtists(c.artist)) set.add(a);
  for (const a of c.openers ?? []) set.add(a);

  if (c.tour && c.tour !== "Live") {
    try {
      const r = await fetch(
        `/api/tour?name=${encodeURIComponent(c.tour)}&artist=${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`
      );
      const d = await r.json();
      if (d.tour?.artist) for (const a of splitArtists(d.tour.artist)) set.add(a);
      for (const a of d.tour?.supportActs ?? []) set.add(a);
    } catch {}
  }
  return [...set].filter((a) => a && a.length > 1).slice(0, 6);
}

/** Shows worth checking: anything with a tour or a multi-artist bill that
 *  hasn't been verified yet. */
export function needsCredits(cs: ConcertRec[]): ConcertRec[] {
  return cs.filter((c) => {
    if (c.creditsChecked || !c.setlist.length) return false;
    const billed = c.artists?.length ? c.artists.length : splitArtists(c.artist).length;
    return billed >= 2 || Boolean(c.tour && c.tour !== "Live") || Boolean(c.openers?.length);
  });
}

/** Re-credit one show. Returns how many songs changed. */
export async function fixConcertCredits(
  concert: ConcertRec,
  onProgress?: (done: number, total: number, song: string) => void
): Promise<number> {
  const acts = await candidateActs(concert);
  if (acts.length < 2) {
    updateConcert(concert.id, { creditsChecked: true });
    return 0;
  }

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

  // anyone who turned out to have performed gets added to the billing
  const performers = [...new Set(Object.values(songArtists).flatMap((v) => splitArtists(v)))];
  const known = new Set((concert.artists ?? []).map((a) => a.name.toLowerCase()));
  const additions = performers.filter((p) => !known.has(p.toLowerCase()) && acts.some((a) => a.toLowerCase() === p.toLowerCase()));

  let artists = concert.artists ?? splitArtists(concert.artist).map((name) => ({ name, imageUrl: null }));
  if (additions.length) {
    const withPhotos = await Promise.all(additions.map(async (name) => {
      try {
        const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
        return { name, imageUrl: (await r.json()).artist?.imageUrl ?? null };
      } catch { return { name, imageUrl: null }; }
    }));
    artists = [...artists, ...withPhotos];
  }

  const names = artists.map((a) => a.name);
  updateConcert(concert.id, {
    songArtists,
    creditsChecked: true,
    artists,
    ...(names.length > 1
      ? { artist: names.length > 4 ? `${names.slice(0, 4).join(" & ")} & more` : names.join(" & ") }
      : {}),
  });
  return changed;
}

/** Fix every show that needs it. */
export async function fixAllCredits(
  onProgress?: (showIdx: number, shows: number, done: number, total: number) => void,
  force = false
): Promise<number> {
  const all = getConcerts();
  const shows = force
    ? all.filter((c) => c.setlist.length > 0)
    : needsCredits(all);
  let total = 0;
  for (let i = 0; i < shows.length; i++) {
    total += await fixConcertCredits(shows[i], (done, count) => onProgress?.(i + 1, shows.length, done, count));
  }
  return total;
}
