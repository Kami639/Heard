// Server-only Spotify wrapper (Client Credentials flow — no user login).
// Used to fetch real artist photos. Key stays server-side.

let cachedToken: { value: string; expires: number } | null = null;

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
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export interface ArtistInfo {
  name: string;
  imageUrl: string | null;
  genres: string[];
  popularity?: number;
}

export async function searchArtist(name: string): Promise<ArtistInfo | null> {
  const token = await getToken();
  const qs = new URLSearchParams({ q: name, type: "artist", limit: "1" });
  const res = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 86400 }, // artist photos rarely change; cache a day
  });
  if (!res.ok) throw new Error(`Spotify search ${res.status}`);
  const data = await res.json();
  const a = data.artists?.items?.[0];
  if (!a) return null;
  return {
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? null,
    genres: a.genres ?? [],
  };
}


/** Tour-aware artwork: try to match the tour name to an album cover
 *  (tours are usually named after albums), fall back to artist photo. */
export async function findArtwork(artist: string, tour?: string | null): Promise<string | null> {
  const token = await getTokenPublic();
  if (tour) {
    const cleaned = tour
      .replace(/\b(the|world|tour|live|presents|arena|stadium|anniversary|\d{4})\b/gi, " ")
      .replace(/[:\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length > 2) {
      const qs = new URLSearchParams({ q: `${cleaned} ${artist}`, type: "album", limit: "5" });
      const res = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const data = await res.json();
        const albums = data.albums?.items ?? [];
        const match = albums.find((a: any) =>
          a.artists?.some((ar: any) => ar.name.toLowerCase() === artist.toLowerCase())
        );
        if (match?.images?.[0]?.url) return match.images[0].url;
      }
    }
  }
  const a = await searchArtist(artist);
  return a?.imageUrl ?? null;
}

async function getTokenPublic(): Promise<string> {
  // reuse the cached client-credentials token
  // @ts-ignore
  return (await (getToken as any)());
}


/** Top-N artist matches for typeahead — Spotify handles partial names well. */
export async function suggestArtists(name: string, limit = 5): Promise<ArtistInfo[]> {
  const token = await getTokenPublic();
  const qs = new URLSearchParams({ q: name, type: "artist", limit: String(limit) });
  const res = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.artists?.items ?? []).map((a: any) => ({
    name: a.name,
    imageUrl: a.images?.at(-1)?.url ?? a.images?.[0]?.url ?? null,
    genres: a.genres ?? [],
    popularity: a.popularity ?? 0,
  }));
}
