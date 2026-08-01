// Keyless backup image sources — Deezer and iTunes both serve artwork with
// no API key. Used automatically whenever Spotify fails or is rate-limited.

const cache = new Map<string, { v: any; exp: number }>();
function cGet(k: string) {
  const h = cache.get(k);
  if (h && Date.now() < h.exp) return h.v;
  if (h) cache.delete(k);
  return undefined;
}
function cSet(k: string, v: any) {
  if (cache.size > 2000) cache.clear();
  cache.set(k, { v, exp: Date.now() + 24 * 3600 * 1000 });
}

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const exact = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  return !!na && !!nb && na === nb;
};
const loose = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
};

async function getJson(url: string): Promise<any | null> {
  const hit = cGet(url);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null; // failures never cached
    const data = await res.json();
    cSet(url, data);
    return data;
  } catch { return null; }
}

export interface FallbackArtist {
  name: string;
  imageUrl: string | null;
  popularity: number;
}

/** Deezer artist search — real artist photos, no key. */
export async function deezerArtists(name: string, limit = 5): Promise<FallbackArtist[]> {
  const data = await getJson(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=${limit}`
  );
  const rows = [...(data?.data ?? [])].sort((a: any, b: any) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));
  return rows.map((a: any) => ({
    name: a.name,
    imageUrl: a.picture_xl ?? a.picture_big ?? a.picture ?? null,
    // fan count -> rough 0-100 popularity so ranking still works
    popularity: Math.min(100, Math.round(Math.log10((a.nb_fan ?? 0) + 1) * 14)),
    followers: a.nb_fan ?? 0,
  }));
}

export async function deezerArtistImage(name: string): Promise<string | null> {
  const list = await deezerArtists(name, 5);
  return (list.find((a) => exact(a.name, name)) ?? list.find((a) => loose(a.name, name)))?.imageUrl ?? null;
}

/** Deezer album search — tour/album covers. */
export async function deezerAlbumArt(albumish: string, artist: string): Promise<string | null> {
  const data = await getJson(
    `https://api.deezer.com/search/album?q=${encodeURIComponent(`${albumish} ${artist}`)}&limit=5`
  );
  const hit = (data?.data ?? []).find((a: any) => exact(a.artist?.name ?? "", artist));
  return hit?.cover_xl ?? hit?.cover_big ?? null;
}

/** iTunes album search — last-resort album art (100px url upscales cleanly). */
export async function itunesAlbumArt(albumish: string, artist: string): Promise<string | null> {
  const qs = new URLSearchParams({ term: `${artist} ${albumish}`, media: "music", entity: "album", limit: "5" });
  const data = await getJson(`https://itunes.apple.com/search?${qs}`);
  const hit = (data?.results ?? []).find((r: any) => exact(r.artistName ?? "", artist));
  return hit?.artworkUrl100 ? hit.artworkUrl100.replace("100x100", "600x600") : null;
}
