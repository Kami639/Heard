import { NextRequest, NextResponse } from "next/server";
import { findArtistMbid, artistSetlists } from "@/lib/setlistfm";

/* Song rarity across a tour.
 *
 * setlist.fm doesn't expose per-song statistics via API, but it does expose
 * every setlist — so we pull a window of the artist's shows, keep the ones
 * on the same tour, and count how often each song appears. "Only played 3
 * of 41 nights" falls straight out.
 *
 * Cost control: at most 4 pages (80 setlists), sequential to respect the
 * ~2 req/sec free tier, and each page is cached for an hour upstream. */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const tour = req.nextUrl.searchParams.get("tour")?.trim();
  if (!artist || !tour) return NextResponse.json({ error: "artist and tour required" }, { status: 400 });
  if (!process.env.SETLISTFM_API_KEY) return NextResponse.json({ totalShows: 0, counts: {} });

  try {
    const mbid = await findArtistMbid(artist);
    if (!mbid) return NextResponse.json({ totalShows: 0, counts: {} });

    const tourKey = norm(tour);
    const counts = new Map<string, { name: string; n: number }>();
    let totalShows = 0;
    let sawTour = false;

    for (let p = 1; p <= 4; p++) {
      let page;
      try { page = await artistSetlists(mbid, p); } catch { break; }
      if (!page.length) break;

      for (const s of page) {
        const onTour = s.tour && norm(s.tour) === tourKey;
        if (!onTour) continue;
        sawTour = true;
        if (!s.setlist.length) continue; // empty logs would skew the denominator
        totalShows++;
        const seen = new Set<string>();
        for (const song of s.setlist) {
          const k = norm(song.name);
          if (!k || seen.has(k)) continue; // count once per night
          seen.add(k);
          const cur = counts.get(k);
          counts.set(k, { name: song.name, n: (cur?.n ?? 0) + 1 });
        }
      }
      // whole page past the tour already? later pages are older — stop.
      if (sawTour && !page.some((s) => s.tour && norm(s.tour) === tourKey)) break;
    }

    const out: Record<string, number> = {};
    for (const [k, v] of counts) out[k] = v.n;
    return NextResponse.json({ totalShows, counts: out });
  } catch {
    return NextResponse.json({ totalShows: 0, counts: {} });
  }
}
