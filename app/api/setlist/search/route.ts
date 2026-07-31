import { NextRequest, NextResponse } from "next/server";
import { searchSetlists, type SetlistResult } from "@/lib/setlistfm";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const artist = sp.get("artist");
  const tourQ = sp.get("tourName");
  const year = sp.get("year") ?? undefined;
  const page = Number(sp.get("p") ?? "1");

  if (!q && !artist && !tourQ) {
    return NextResponse.json({ error: "q, artist or tourName required" }, { status: 400 });
  }

  try {
    let results: SetlistResult[] = [];

    if (q) {
      // Smart search: artists, tours, and venues/festivals in one shot.
      // Sequential with small gaps to respect setlist.fm's ~2 req/sec limit.
      const merged = new Map<string, SetlistResult>();
      const runs: Array<Partial<Parameters<typeof searchSetlists>[0]>> =
        page > 1
          ? [{ artistName: q }] // only paginate the artist search
          : [{ artistName: q }, { tourName: q }, { venueName: q }];

      for (let i = 0; i < runs.length; i++) {
        if (i > 0) await sleep(350);
        try {
          const batch = await searchSetlists({ ...runs[i], year, p: page });
          for (const r of batch) merged.set(r.setlistFmId, r);
        } catch (e: any) {
          if (e?.rateLimited && merged.size === 0 && i === runs.length - 1) throw e;
          // otherwise keep whatever we already have
        }
      }
      results = [...merged.values()].slice(0, 30);
    } else {
      results = await searchSetlists({
        artistName: artist ?? undefined,
        tourName: tourQ ?? undefined,
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
