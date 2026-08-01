"use client";

import { getConcerts, updateConcert } from "./store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Bumped when the attribution logic improves, so every show gets re-checked
 *  once instead of being stuck behind an old "already checked" flag. */
export const CREDITS_VERSION = 2;

interface TourFacts { artists: string[]; songArtists: Record<string, string> }

async function tourFacts(c: ConcertRec): Promise<TourFacts> {
  if (!c.tour || c.tour === "Live") return { artists: [], songArtists: {} };
  try {
    const r = await fetch(
      `/api/tour-artists?tour=${encodeURIComponent(c.tour)}&artist=${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`
    );
    const d = await r.json();
    return { artists: d.artists ?? [], songArtists: d.songArtists ?? {} };
  } catch { return { artists: [], songArtists: {} }; }
}

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
    if (!c.setlist.length) return false;
    if ((c.creditsVersion ?? 0) >= CREDITS_VERSION) return false;
    const billed = c.artists?.length ? c.artists.length : splitArtists(c.artist).length;
    return billed >= 2 || Boolean(c.tour && c.tour !== "Live") || Boolean(c.openers?.length);
  });
}

/** Re-credit one show. Returns how many songs changed. */
export async function fixConcertCredits(
  concert: ConcertRec,
  onProgress?: (done: number, total: number, song: string) => void
): Promise<number> {
  const facts = await tourFacts(concert);

  const acts = [...new Set([
    ...(concert.artists ?? []).map((a) => a.name),
    ...splitArtists(concert.artist),
    ...(concert.openers ?? []),
    ...facts.artists,
  ])].filter((a) => a && a.length > 1);

  // scrub any credit that is really the event's name
  const eventish = (name: string) =>
    !name ||
    norm(name) === norm(concert.tour ?? "") ||
    (/\b(festival|fest|tour|stage)\b/i.test(name) && !acts.some((a) => norm(a) === norm(name)));

  const songArtists: Record<string, string> = {};
  for (const [song, who] of Object.entries(concert.songArtists ?? {})) {
    if (!eventish(who)) songArtists[song] = who;
  }
  let changed = 0;

  // 1) straight from the tour's own set lists — no guessing, no API per song
  for (const song of concert.setlist) {
    const known = facts.songArtists[norm(song)];
    if (known && known !== songArtists[song]) {
      songArtists[song] = known;
      changed++;
    }
  }

  // 2) anything still ambiguous gets checked against the catalogues
  if (acts.length >= 2) {
    for (let i = 0; i < concert.setlist.length; i++) {
      const song = concert.setlist[i];
      onProgress?.(i + 1, concert.setlist.length, song);

      const current = songArtists[song];
      if (current && acts.some((a) => norm(a) === norm(current))) continue;   // already a real act
      if (current && splitArtists(current).length > 1 && facts.songArtists[norm(song)]) continue; // joint, confirmed

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
  }

  // everyone who turned out to have performed joins the billing
  const performers = [...new Set(Object.values(songArtists).flatMap((v) => splitArtists(v)))];
  const existing = concert.artists ?? splitArtists(concert.artist).map((name) => ({ name, imageUrl: null }));
  const known = new Set(existing.map((a) => a.name.toLowerCase()));
  const additions = performers.filter((p) => !known.has(p.toLowerCase()));

  let artists = existing;
  if (additions.length) {
    const withPhotos = await Promise.all(additions.slice(0, 4).map(async (name) => {
      try {
        const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
        return { name, imageUrl: (await r.json()).artist?.imageUrl ?? null };
      } catch { return { name, imageUrl: null }; }
    }));
    artists = [...existing, ...withPhotos];
  }

  const names = artists.map((a) => a.name);
  updateConcert(concert.id, {
    songArtists,
    // only call it done if we actually had something to work with, so a
    // temporary API outage doesn't permanently mark the show as checked
    ...(acts.length >= 2 || Object.keys(facts.songArtists).length ? { creditsVersion: CREDITS_VERSION } : {}),
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
