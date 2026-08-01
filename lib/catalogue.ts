import { politeJson } from "./requestQueue";
import type { Candidate } from "./songMatch";

/* Fetch an artist's actual catalogue, then match locally.
 *
 * Text search can't bridge stylization: setlist.fm says "Fein", the stores say
 * "FE!N", and searching "Travis Scott Fein" returns nothing useful no matter
 * how clever our comparison is — the store's own search never surfaces the
 * track. Pulling the artist's songs and comparing them ourselves sidesteps
 * their tokenizer entirely, because our normalizer knows "FE!N" reads "fein".
 */

const cache = new Map<string, { v: Candidate[]; exp: number }>();
const DAY = 24 * 3600 * 1000;

async function itunesCatalogue(artist: string): Promise<Candidate[]> {
  const found = await politeJson<any>(
    `https://itunes.apple.com/search?${new URLSearchParams({
      term: artist, entity: "musicArtist", limit: "1",
    })}`,
    { ttl: 7 * DAY }
  );
  const artistId = found?.results?.[0]?.artistId;
  if (!artistId) return [];

  const data = await politeJson<any>(
    `https://itunes.apple.com/lookup?${new URLSearchParams({
      id: String(artistId), entity: "song", limit: "200",
    })}`,
    { ttl: DAY }
  );

  return (data?.results ?? [])
    .filter((r: any) => r.wrapperType === "track" && r.trackName)
    .map((r: any) => ({
      title: r.trackName,
      artist: r.artistName ?? artist,
      previewUrl: r.previewUrl ?? null,
      durationMs: r.trackTimeMillis ?? null,
    }));
}

async function deezerCatalogue(artist: string): Promise<Candidate[]> {
  const found = await politeJson<any>(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=5`,
    { ttl: 7 * DAY }
  );
  const rows = [...(found?.data ?? [])].sort((a: any, b: any) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));
  const id = rows[0]?.id;
  if (!id) return [];

  const out: Candidate[] = [];
  // top tracks cover the vast majority of anything played live
  const top = await politeJson<any>(`https://api.deezer.com/artist/${id}/top?limit=100`, { ttl: DAY });
  for (const t of top?.data ?? []) {
    out.push({
      title: t.title ?? "",
      artist: t.artist?.name ?? artist,
      previewUrl: t.preview ?? null,
      durationMs: t.duration ? t.duration * 1000 : null,
    });
  }
  return out;
}

/** Everything we can cheaply know that this artist has released. */
export async function artistCatalogue(artist: string): Promise<Candidate[]> {
  const key = artist.toLowerCase().trim();
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;

  const [itunes, deezer] = await Promise.all([
    itunesCatalogue(artist).catch(() => []),
    deezerCatalogue(artist).catch(() => []),
  ]);

  // prefer entries that actually carry a preview
  const merged = [...itunes, ...deezer].sort((a, b) => Number(!!b.previewUrl) - Number(!!a.previewUrl));
  if (merged.length) {
    if (cache.size > 300) cache.clear();
    cache.set(key, { v: merged, exp: Date.now() + DAY });
  }
  return merged;
}
