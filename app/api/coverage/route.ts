import { NextRequest, NextResponse } from "next/server";
import { politeJson } from "@/lib/requestQueue";
import { titleVariants } from "@/lib/songMatch";

/* "How much of their catalogue have you heard live?"
   MusicBrainz knows an artist's released songs; we know which ones you've
   witnessed. Nobody else in this space shows that. */

const cache = new Map<string, { v: any; exp: number }>();
const nk = (s: string) => [...titleVariants(s)][0] ?? s.toLowerCase();

export async function POST(req: NextRequest) {
  let body: { artist?: string; heard?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ coverage: null }); }
  const artist = body.artist?.trim();
  if (!artist) return NextResponse.json({ coverage: null });

  const key = artist.toLowerCase();
  let catalogue: string[] | undefined = cache.get(key)?.v;
  if (!catalogue || Date.now() > (cache.get(key)?.exp ?? 0)) {
    const found = await politeJson<any>(
      `https://musicbrainz.org/ws/2/artist?${new URLSearchParams({
        query: `artist:"${artist.replace(/"/g, "")}"`, fmt: "json", limit: "1",
      })}`,
      { ttl: 30 * 24 * 3600 * 1000 }
    );
    const mbid = found?.artists?.[0]?.id;
    if (!mbid) return NextResponse.json({ coverage: null });

    // official studio releases only — live albums would double-count
    const works = await politeJson<any>(
      `https://musicbrainz.org/ws/2/recording?${new URLSearchParams({
        artist: mbid, fmt: "json", limit: "100",
      })}`,
      { ttl: 7 * 24 * 3600 * 1000 }
    );
    catalogue = [...new Set((works?.recordings ?? [])
      .map((r: any) => r.title)
      .filter(Boolean)
      .map((t: string) => nk(t)))] as string[];
    if (cache.size > 200) cache.clear();
    cache.set(key, { v: catalogue, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  }

  const heard = new Set((body.heard ?? []).map(nk));
  const seen = catalogue.filter((t) => heard.has(t));

  return NextResponse.json({
    coverage: {
      catalogue: catalogue.length,
      heard: seen.length,
      percent: catalogue.length ? Math.round((seen.length / catalogue.length) * 100) : 0,
    },
  });
}
