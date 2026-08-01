import { NextRequest, NextResponse } from "next/server";

// Venue photos via Wikipedia — free, keyless, and most notable venues
// have an article with a lead image.

const cache = new Map<string, { v: any; exp: number }>();

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  const city = req.nextUrl.searchParams.get("city") ?? "";
  if (!name) return NextResponse.json({ imageUrl: null });

  const key = `${name}|${city}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return NextResponse.json(hit.v);

  try {
    const qs = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${name} ${city}`.trim(),
      gsrlimit: "4",
      prop: "pageimages|categories|extracts",
      piprop: "thumbnail",
      pithumbsize: "640",
      cllimit: "max",
      exintro: "1",
      explaintext: "1",
      exsentences: "2",
      format: "json",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${qs}`, {
      headers: { "User-Agent": "heard-app/1.0 (concert archive)" },
      cache: "no-store",
    });
    if (res.ok) {
      const pages = Object.values((await res.json()).query?.pages ?? {}) as any[];
      const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const VENUE_WORDS = /venue|arena|stadium|theat|hall|amphitheat|club|auditorium|ballroom|concert|coliseum|pavilion|music/i;
      const withImg = pages
        .sort((a, b) => (a.index ?? 9) - (b.index ?? 9))
        .find((p) => {
          if (!p.thumbnail?.source) return false;
          // the article must look like this venue, in this city — otherwise a
          // random article with a matching name gets used as the photo
          const cats = (p.categories ?? []).map((c: any) => c.title ?? "").join(" ");
          const blurb = `${p.title ?? ""} ${p.extract ?? ""} ${cats}`;
          const titleMatches = nk(p.title ?? "").includes(nk(name)) || nk(name).includes(nk(p.title ?? ""));
          const looksLikeVenue = VENUE_WORDS.test(blurb);
          const rightCity = !city || new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(blurb);
          return titleMatches && looksLikeVenue && rightCity;
        });
      const out = { imageUrl: withImg?.thumbnail?.source ?? null, title: withImg?.title ?? null };
      if (out.imageUrl) { // success-only cache
        if (cache.size > 1000) cache.clear();
        cache.set(key, { v: out, exp: Date.now() + 7 * 24 * 3600 * 1000 });
      }
      return NextResponse.json(out);
    }
  } catch {}
  return NextResponse.json({ imageUrl: null });
}
