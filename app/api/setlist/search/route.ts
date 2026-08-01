import { NextRequest, NextResponse } from "next/server";
import { searchSetlists, type SetlistResult } from "@/lib/setlistfm";
import { COUNTRY_CODES } from "@/lib/countries";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const artist = sp.get("artist");
  const tourQ = sp.get("tourName");
  const year = sp.get("year") ?? undefined;
  const countryFilter = sp.get("country") ?? undefined; // explicit dropdown
  const page = Number(sp.get("p") ?? "1");

  if (!q && !artist && !tourQ) {
    return NextResponse.json({ error: "q, artist or tourName required" }, { status: 400 });
  }

  try {
    let results: SetlistResult[] = [];

    if (q) {
      const merged = new Map<string, SetlistResult>();
      const base = countryFilter ? { countryCode: countryFilter } : {};
      const run = async (extra: Parameters<typeof searchSetlists>[0], p = 1) => {
        try {
          const batch = await searchSetlists({ ...base, ...extra, year, p });
          for (const r of batch) merged.set(r.setlistFmId, r);
        } catch {}
      };

      if (page > 1) {
        await run({ artistName: q }, page);
      } else {
        // Artist first — it's the common case, so we go deep on it and only
        // fan out to tour/venue/city when the artist search comes up thin.
        await run({ artistName: q });
        const artistHits = merged.size;
        if (artistHits >= 20) { await sleep(250); await run({ artistName: q }, 2); }
        await sleep(250); await run({ tourName: q });
        const asCountry = COUNTRY_CODES[q.toLowerCase().trim()];
        if (asCountry && !countryFilter) {
          await sleep(250); await run({ countryCode: asCountry });
        } else if (artistHits < 10) {
          await sleep(250); await run({ venueName: q });
          await sleep(250); await run({ cityName: q });
        }
      }

      // Relevance gate: every kept result must actually contain the query
      // somewhere (artist/tour/venue/city). Kills "Devil Wears Prada" when
      // you searched "Pradabagshawty".
      const nq = norm(q);
      const relevant = [...merged.values()].filter((r) => {
        for (const f of [r.artist, r.tour ?? "", r.venue, r.city]) {
          const nf = norm(f);
          if (!nf) continue;
          if (nf.includes(nq) || (nq.includes(nf) && nf.length > 3)) return true;
        }
        return false;
      });
      results = (relevant.length ? relevant : [...merged.values()]).slice(0, 60);
    } else {
      results = await searchSetlists({
        artistName: artist ?? undefined,
        tourName: tourQ ?? undefined,
        countryCode: countryFilter,
        year,
        p: page,
      });
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    if (e?.rateLimited) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "setlist.fm unavailable" }, { status: 502 });
  }
}
