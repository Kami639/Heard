import { NextRequest, NextResponse } from "next/server";
import { searchSetlists } from "@/lib/setlistfm";

// Everyone who played a given night. setlist.fm files one setlist PER ARTIST,
// so a festival day or a package tour (Antagonist: Carti + Ken Carson +
// Destroy Lonely + Homixide Gang + ApolloRed1) is really several setlists
// sharing a venue and a date.

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const venue = sp.get("venue") ?? "";
  const city = sp.get("city") ?? "";
  const iso = sp.get("date") ?? ""; // yyyy-mm-dd
  const tour = sp.get("tour") ?? "";
  if (!iso || (!venue && !city)) return NextResponse.json({ acts: [] });

  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return NextResponse.json({ acts: [] });
  const setlistFmDate = `${d}-${m}-${y}`;

  try {
    const [byVenue, byCity] = await Promise.all([
      venue ? searchSetlists({ venueName: venue, date: setlistFmDate }).catch(() => []) : Promise.resolve([]),
      city ? searchSetlists({ cityName: city, date: setlistFmDate }).catch(() => []) : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const acts = [...byVenue, ...byCity]
      .filter((r) => {
        // Same room is required. A city match alone is NOT enough — two
        // different concerts happen in one city on the same night, which is
        // how a stray act's songs could end up in the wrong show.
        const sameVenue = venue && (norm(r.venue).includes(norm(venue)) || norm(venue).includes(norm(r.venue)));
        const sameTour = tour && r.tour && (norm(r.tour) === norm(tour));
        const sameCity = city && norm(r.city) === norm(city);
        if (!sameVenue && !(sameCity && sameTour)) return false;
        const k = norm(r.artist);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((r) => ({
        artist: r.artist,
        songs: r.setlist.map((s) => s.name),
        covers: Object.fromEntries(r.setlist.filter((s) => s.cover).map((s) => [s.name, s.cover])),
        guests: [...new Set(r.setlist.map((s) => s.withGuest).filter(Boolean))],
        tour: r.tour,
      }))
      .sort((a, b) => b.songs.length - a.songs.length); // headliner first

    return NextResponse.json({ acts });
  } catch {
    return NextResponse.json({ acts: [] });
  }
}
