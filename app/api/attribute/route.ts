import { NextRequest, NextResponse } from "next/server";
import { politeJson } from "@/lib/requestQueue";
import { titleAccepted, artistAccepted, isJunkArtist, titleVariants, pickTrack } from "@/lib/songMatch";
import { artistCatalogue } from "@/lib/catalogue";

/* Who actually performed this song, given everyone who played that night?
   Checked against real catalogues instead of assuming the headliner, so
   "Bank Account" lands on 21 Savage and "Mr. Right Now" is credited to both.

   Order: Deezer (keyless, fast, generous) -> iTunes -> MusicBrainz (1 req/s,
   authoritative artist credits). Results cached for a month. */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const base = (x: string) => norm(x.replace(/\(.*?\)|\[.*?\]/g, "").split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0]);

const cache = new Map<string, { v: any; exp: number }>();

// one matcher for the whole app: stylization-aware, exact for short titles
const titleMatch = (a: string, b: string) => titleAccepted(b, a);

/** Deezer: does this artist have this track? Returns the full credit string. */
async function deezerCredit(artist: string, song: string): Promise<string | null> {
  try {
    const spelling = [...titleVariants(song)][0] ?? song;
    const q = `artist:"${artist}" track:"${spelling}"`;
    const data = await politeJson<any>(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
    const items = data?.data ?? [];
    const hit = items.find(
      (r: any) => !isJunkArtist(r.artist?.name ?? "") &&
        titleMatch(r.title ?? "", song) && artistAccepted(r.artist?.name ?? "", artist)
    );
    return hit ? `${hit.artist?.name ?? artist}::${hit.title ?? song}` : null;
  } catch { return null; }
}

async function itunesCredit(artist: string, song: string): Promise<string | null> {
  try {
    const spelling = [...titleVariants(song)][0] ?? song;
    const qs = new URLSearchParams({ term: `${artist} ${spelling}`, media: "music", entity: "song", limit: "8" });
    const data = await politeJson<any>(`https://itunes.apple.com/search?${qs}`, { ttl: 7 * 24 * 3600 * 1000 });
    const items = data?.results ?? [];
    const hit = items.find(
      (r: any) => !isJunkArtist(r.artistName ?? "") &&
        titleMatch(r.trackName ?? "", song) && artistAccepted(r.artistName ?? "", artist)
    );
    return hit ? `${hit.artistName ?? artist}::${hit.trackName ?? song}` : null;
  } catch { return null; }
}

async function musicbrainzCredit(song: string, artists: string[]) {
  const escaped = song.replace(/["\\]/g, " ");
  const qs = new URLSearchParams({ query: `recording:"${escaped}"`, fmt: "json", limit: "25" });
  const data: any = await politeJson(`https://musicbrainz.org/ws/2/recording?${qs}`, {
    ttl: 30 * 24 * 3600 * 1000,
  });

  let best: { artist: string; score: number; credited: string[] } | null = null;
  for (const r of data?.recordings ?? []) {
    if (!titleMatch(r.title ?? "", song)) continue;
    const credits: string[] = (r["artist-credit"] ?? []).map((ac: any) => ac?.name ?? ac?.artist?.name ?? "");
    const primary = artists.find((a) => base(a) === base(credits[0] ?? ""));
    if (!primary) continue;
    const score = Number(r.score ?? 0);
    if (!best || score > best.score) {
      best = { artist: primary, score, credited: artists.filter((a) => credits.some((c) => base(c) === base(a))) };
    }
  }
  return best;
}

export async function GET(req: NextRequest) {
  const song = req.nextUrl.searchParams.get("song");
  const artists = (req.nextUrl.searchParams.get("artists") ?? "")
    .split("|").map((a) => a.trim()).filter(Boolean).slice(0, 5);
  if (!song || artists.length < 2) return NextResponse.json({ artist: null });

  const key = `${norm(song)}|${artists.map(norm).sort().join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return NextResponse.json(hit.v);

  const remember = (v: any) => {
    if (v.artist) {
      if (cache.size > 4000) cache.clear();
      cache.set(key, { v, exp: Date.now() + 30 * 24 * 3600 * 1000 });
    }
    return NextResponse.json(v);
  };

  // 1) catalogue check, all candidates in parallel. Search first (fast), then
  // the artist's full catalogue, which is the only thing that can match a
  // stylized title from a plain one.
  const found = await Promise.all(
    artists.map(async (a) => {
      const credit = (await deezerCredit(a, song)) ?? (await itunesCredit(a, song));
      if (credit) return { artist: a, credit };
      try {
        const hit = pickTrack(await artistCatalogue(a), song, [a]);
        if (hit) return { artist: a, credit: `${hit.artist}::${hit.title}` };
      } catch {}
      return null;
    })
  );
  const owners = found.filter(Boolean) as { artist: string; credit: string }[];

  if (owners.length === 1) {
    return remember({ artist: owners[0].artist, credited: [owners[0].artist], confidence: "high" });
  }

  if (owners.length > 1) {
    // several billed artists have the track: it's a collaboration. The one
    // credited FIRST on the release is the primary.
    const primary = owners.find((o) => {
      const creditedName = o.credit.split("::")[0];
      return base(creditedName) === base(o.artist);
    }) ?? owners[0];
    const credited = owners.map((o) => o.artist);
    return remember({ artist: primary.artist, credited, confidence: "high" });
  }

  // 2) nothing in the catalogues -> ask MusicBrainz
  const mb = await musicbrainzCredit(song, artists);
  if (mb) return remember({ artist: mb.artist, credited: mb.credited.length ? mb.credited : [mb.artist], confidence: mb.score >= 90 ? "high" : "medium" });

  return NextResponse.json({ artist: null });
}
