import { NextRequest, NextResponse } from "next/server";
import { searchSetlists } from "@/lib/setlistfm";
import { fetchTourInfo } from "@/lib/wikiTour";

/* Everything we can learn about who performed what on a tour.
   Two independent sources, so this still works if either one is unavailable:
     - setlist.fm: one setlist per artist, so the artist list AND the per-song
       attribution both fall straight out of it
     - Wikipedia: the article's per-artist set lists ("Drake", "21 Savage",
       "Drake & 21 Savage") */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const cache = new Map<string, { v: any; exp: number }>();

export async function GET(req: NextRequest) {
  const tour = req.nextUrl.searchParams.get("tour");
  const artist = req.nextUrl.searchParams.get("artist") ?? "";
  if (!tour) return NextResponse.json({ artists: [], songArtists: {} });

  const key = `${norm(tour)}|${norm(artist)}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return NextResponse.json(hit.v);

  const artists = new Set<string>();
  const EVENTISH = /\b(festival|fest|tour|stage|weekend)\b/i;
  const isEvent = (name: string) =>
    norm(name) === norm(tour) || (EVENTISH.test(name) && norm(name).includes(norm(tour).slice(0, 8)));
  const songArtists: Record<string, string> = {};

  // setlist.fm — authoritative, because each setlist IS one artist's set
  try {
    for (let p = 1; p <= 2; p++) {
      const rows = await searchSetlists({ tourName: tour, p });
      for (const r of rows) {
        if (!r.artist || isEvent(r.artist)) continue;
        artists.add(r.artist);
        for (const s of r.setlist) {
          const k = norm(s.name);
          if (!k) continue;
          // a song played by two acts on the tour is a joint song
          const prev = songArtists[k];
          if (!prev) songArtists[k] = r.artist;
          else if (norm(prev) !== norm(r.artist) && !prev.includes(r.artist)) {
            songArtists[k] = `${prev} & ${r.artist}`;
          }
        }
      }
      if (rows.length < 20) break;
    }
  } catch {}

  // Wikipedia — per-artist set lists on the tour article
  try {
    const info = await fetchTourInfo(tour, artist || undefined);
    for (const a of (info?.artist ?? "").split(/\s*(?:&|,|\band\b)\s*/i)) {
      if (a.trim().length > 1) artists.add(a.trim());
    }
    for (const a of info?.supportActs ?? []) artists.add(a);
    for (const set of info?.sets ?? []) {
      if (!set.artist || isEvent(set.artist)) continue;
      artists.add(set.artist);
      for (const song of set.songs) {
        const k = norm(song);
        if (k && !songArtists[k]) songArtists[k] = set.artist;
      }
    }
  } catch {}

  const out = { artists: [...artists].slice(0, 8), songArtists };
  if (out.artists.length) {
    if (cache.size > 500) cache.clear();
    cache.set(key, { v: out, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  }
  return NextResponse.json(out);
}
