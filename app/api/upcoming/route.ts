import { NextRequest, NextResponse } from "next/server";
import { fetchArtistTours, fetchTourInfo } from "@/lib/wikiTour";

/* Upcoming shows for artists already in your archive.
   Built from tour articles you can verify, rather than a paid listings API:
   for each artist, look at their tours and surface any dates still ahead. */

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function toIso(s: string): string | null {
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  return null;
}

/* Ticketmaster Discovery: real listings with on-sale dates, 5,000 free
   calls/day. When a key is present this becomes the primary source and the
   Wikipedia tour-article scrape becomes the fallback. */
async function ticketmasterShows(artist: string): Promise<any[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  try {
    const qs = new URLSearchParams({
      apikey: key, keyword: artist, classificationName: "music",
      size: "8", sort: "date,asc",
    });
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`, {
      next: { revalidate: 3600 * 6 },
    });
    if (!res.ok) return [];
    const events = (await res.json())?._embedded?.events ?? [];
    return events
      .filter((e: any) => {
        // keyword search is fuzzy; require the artist on the actual bill
        const acts = (e._embedded?.attractions ?? []).map((a: any) => nk(a.name ?? ""));
        return acts.length === 0 || acts.some((a: string) => a === nk(artist) || a.includes(nk(artist)));
      })
      .map((e: any) => {
        const v = e._embedded?.venues?.[0];
        return {
          artist,
          tour: e.name,
          date: e.dates?.start?.localDate,
          city: v?.city?.name ?? "",
          venue: v?.name ?? "",
          url: e.url ?? null,
          source: "ticketmaster",
        };
      })
      .filter((s: any) => s.date);
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const artists = (req.nextUrl.searchParams.get("artists") ?? "")
    .split("|").map((a) => a.trim()).filter(Boolean).slice(0, 8);
  if (!artists.length) return NextResponse.json({ shows: [] });

  const today = new Date().toISOString().slice(0, 10);
  const shows: any[] = [];

  // Ticketmaster first, in parallel — it's fast and rate-generous
  const tm = (await Promise.all(artists.map(ticketmasterShows))).flat()
    .filter((s) => s.date > today);
  shows.push(...tm);
  const covered = new Set(tm.map((s) => s.artist.toLowerCase()));

  for (const artist of artists.filter((a) => !covered.has(a.toLowerCase()))) {
    try {
      const tours = await fetchArtistTours(artist);
      // most recent tours first — those are the ones with future dates
      for (const tour of tours.slice(-3).reverse()) {
        const info = await fetchTourInfo(tour, artist);
        for (const d of info?.dates ?? []) {
          if (d.cancelled) continue;
          const iso = toIso(d.date);
          if (!iso || iso <= today) continue;
          shows.push({ artist, tour: info?.title ?? tour, date: iso, city: d.city, venue: d.venue });
        }
        if (shows.length > 40) break;
      }
    } catch {}
  }

  // dedupe across sources (same artist + date = same night)
  const seen = new Set<string>();
  const unique = shows.filter((s) => {
    const k = `${s.artist.toLowerCase()}|${s.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  unique.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ shows: unique.slice(0, 25) });
}
