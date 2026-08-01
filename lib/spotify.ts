// Server-only Spotify wrapper (Client Credentials flow).
// Uses an in-memory cache that stores ONLY successes — a rate-limited or
// failed lookup is never remembered, so images come back on their own
// once Spotify stops throttling.

let cachedToken: { value: string; expires: number } | null = null;

const memCache = new Map<string, { v: any; exp: number }>();
function cacheGet(key: string) {
  const hit = memCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;
  if (hit) memCache.delete(key);
  return undefined;
}
function cacheSet(key: string, v: any, ttlMs: number) {
  if (memCache.size > 2000) memCache.clear();
  memCache.set(key, { v, exp: Date.now() + ttlMs });
}

async function getToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify credentials not set");
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.value;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function spotifyGet(path: string): Promise<any | null> {
  const cached = cacheGet(path);
  if (cached !== undefined) return cached;
  try {
    const token = await getToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null; // NOT cached — retries next request
    const data = await res.json();
    cacheSet(path, data, 24 * 3600 * 1000); // successes cached a day
    return data;
  } catch {
    return null;
  }
}

export interface ArtistInfo {
  name: string;
  imageUrl: string | null;
  genres: string[];
  popularity?: number;
  followers?: number;
}

export async function searchArtist(name: string): Promise<ArtistInfo | null> {
  const qs = new URLSearchParams({ q: name, type: "artist", limit: "1" });
  const data = await spotifyGet(`/search?${qs}`);
  const a = data?.artists?.items?.[0];
  if (!a) return null;
  return {
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? null,
    genres: a.genres ?? [],
    popularity: a.popularity ?? 0,
    followers: a.followers?.total ?? 0,
  };
}

export async function suggestArtists(name: string, limit = 5): Promise<ArtistInfo[]> {
  const qs = new URLSearchParams({ q: name, type: "artist", limit: String(limit) });
  const data = await spotifyGet(`/search?${qs}`);
  return (data?.artists?.items ?? []).map((a: any) => ({
    name: a.name,
    imageUrl: a.images?.at(-1)?.url ?? a.images?.[0]?.url ?? null,
    genres: a.genres ?? [],
    popularity: a.popularity ?? 0,
  }));
}

const normName = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
// Album credits must match the artist EXACTLY (after normalizing punctuation).
// Substring matching pulled in bootlegs like "Drake feat Nove Brilliant".
function looseNameMatch(a: string, b: string): boolean {
  const na = normName(a), nb = normName(b);
  return !!na && !!nb && na === nb;
}
function splitBilling(name: string): string[] {
  return name.split(/\s*(?:&|\+|,|\/)\s*|\s+(?:and|x|con)\s+/i).map((x) => x.trim()).filter(Boolean);
}

/** Tour-aware artwork: match tour name to an album cover, else artist photo.
 *  Handles multi-artist billings by trying each artist. */
export async function findArtwork(artist: string, tour?: string | null): Promise<string | null> {
  const candidates = [...new Set([artist, ...splitBilling(artist)])].slice(0, 3);
  if (tour) {
    const cleaned = tour
      .replace(/\b(the|world|tour|live|presents|arena|stadium|anniversary|\d{4})\b/gi, " ")
      .replace(/[:\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length > 2) {
      for (const cand of candidates) {
        const qs = new URLSearchParams({ q: `${cleaned} ${cand}`, type: "album", limit: "5" });
        const data = await spotifyGet(`/search?${qs}`);
        const match = (data?.albums?.items ?? []).find((a: any) =>
          a.artists?.some((ar: any) => looseNameMatch(ar.name ?? "", cand))
        );
        if (match?.images?.[0]?.url) return match.images[0].url;
      }
    }
  }
  for (const cand of candidates) {
    const a = await searchArtist(cand);
    if (a?.imageUrl) return a.imageUrl;
  }
  return null;
}
