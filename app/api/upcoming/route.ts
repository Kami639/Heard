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

export async function GET(req: NextRequest) {
  const artists = (req.nextUrl.searchParams.get("artists") ?? "")
    .split("|").map((a) => a.trim()).filter(Boolean).slice(0, 8);
  if (!artists.length) return NextResponse.json({ shows: [] });

  const today = new Date().toISOString().slice(0, 10);
  const shows: any[] = [];

  for (const artist of artists) {
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

  shows.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ shows: shows.slice(0, 25) });
}
