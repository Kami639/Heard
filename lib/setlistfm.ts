// Server-only Setlist.fm wrapper. Keep the API key off the client —
// call this from route handlers / server components only.
// Docs: https://api.setlist.fm/docs/1.0/index.html
// Rate limit is ~2 req/sec on the free tier: cache responses.

import type { SetlistSong } from "@/features/concerts/types";

const BASE = "https://api.setlist.fm/rest/1.0";

export interface SetlistResult {
  setlistFmId: string;
  artist: string;
  tour: string | null;
  venue: string;
  city: string;
  country: string;
  songArtists?: Record<string, string>;
  openers?: string[];
  attendance?: string | null;
  wikiSourced?: boolean;
  setlistFromWiki?: boolean;
  cancelledShow?: boolean;
  date: string; // ISO yyyy-mm-dd
  setlist: SetlistSong[];
  lat: number | null;
  lng: number | null;
  info: string | null;
}

export async function searchSetlists(params: {
  artistName?: string;
  tourName?: string;
  venueName?: string;
  countryCode?: string;
  date?: string; // dd-MM-yyyy per setlist.fm
  cityName?: string;
  year?: string;
  p?: number;
}): Promise<SetlistResult[]> {
  const key = process.env.SETLISTFM_API_KEY;
  if (!key) throw new Error("SETLISTFM_API_KEY is not set");

  const qs = new URLSearchParams();
  if (params.artistName) qs.set("artistName", params.artistName);
  if (params.tourName) qs.set("tourName", params.tourName);
  if (params.venueName) qs.set("venueName", params.venueName);
  if (params.countryCode) qs.set("countryCode", params.countryCode);
  if (params.date) qs.set("date", params.date);
  if (params.cityName) qs.set("cityName", params.cityName);
  if (params.year) qs.set("year", params.year);
  qs.set("p", String(params.p ?? 1));

  const res = await fetch(`${BASE}/search/setlists?${qs}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    // Cache identical searches for an hour to respect the rate limit.
    next: { revalidate: 3600 },
  });

  if (res.status === 404) return []; // setlist.fm returns 404 for "no results"
  if (res.status === 429) { const e: any = new Error("rate limited"); e.rateLimited = true; throw e; }
  if (!res.ok) throw new Error(`setlist.fm ${res.status}`);

  const data = await res.json();
  return mapSetlists(data.setlist ?? []);
}

function mapSetlists(list: any[]): SetlistResult[] {
  return list.map(mapSetlist);
}

function mapSetlist(s: any): SetlistResult {
  const songs: SetlistSong[] = (s.sets?.set ?? []).flatMap(
    (set: any, i: number) =>
      (set.song ?? []).filter((song: any) => !song.tape).map((song: any) => ({
        name: song.name,
        encore: Boolean(set.encore) || i > 0 && Boolean(set.encore),
        cover: song.cover?.name ?? null,
        withGuest: song.with?.name ?? null,
      }))
  );
  // dd-MM-yyyy -> ISO
  const [dd, mm, yyyy] = String(s.eventDate).split("-");
  return {
    setlistFmId: s.id,
    artist: s.artist?.name ?? "",
    tour: s.tour?.name ?? null,
    venue: s.venue?.name ?? "",
    city: s.venue?.city?.name ?? "",
    country: s.venue?.city?.country?.code ?? "",
    date: `${yyyy}-${mm}-${dd}`,
    setlist: songs,
    lat: s.venue?.city?.coords?.lat ?? null,
    lng: s.venue?.city?.coords?.long ?? null,
    info: s.info ?? null,
  };
}

/** Resolve an artist to their MusicBrainz id — the only way to get an
 *  EXACT artist match out of setlist.fm (artistName search is fuzzy and will
 *  happily return a venue called "Divadlo Drak" for "Drake"). */
export interface ArtistCandidate { mbid: string; name: string }

/** Artist candidates from setlist.fm, so callers can judge exactness. */
export async function searchArtistCandidates(name: string): Promise<ArtistCandidate[]> {
  const key = process.env.SETLISTFM_API_KEY;
  if (!key) return [];
  const qs = new URLSearchParams({ artistName: name, sort: "relevance", p: "1" });
  const res = await fetch(`https://api.setlist.fm/rest/1.0/search/artists?${qs}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return ((await res.json()).artist ?? [])
    .filter((a: any) => a?.mbid && a?.name)
    .map((a: any) => ({ mbid: a.mbid, name: a.name }));
}

export async function findArtistMbid(name: string): Promise<string | null> {
  const key = process.env.SETLISTFM_API_KEY;
  if (!key) return null;
  const qs = new URLSearchParams({ artistName: name, sort: "relevance", p: "1" });
  const res = await fetch(`https://api.setlist.fm/rest/1.0/search/artists?${qs}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const items = (await res.json()).artist ?? [];
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = items.find((a: any) => nk(a.name ?? "") === nk(name));
  return (exact ?? items[0])?.mbid ?? null;
}

/** All setlists for one artist, by mbid — no fuzzy bleed. */
export async function artistSetlists(mbid: string, p = 1): Promise<SetlistResult[]> {
  const key = process.env.SETLISTFM_API_KEY;
  if (!key) throw new Error("setlist.fm key missing");
  const res = await fetch(`https://api.setlist.fm/rest/1.0/artist/${mbid}/setlists?p=${p}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`setlist.fm ${res.status}`);
  return mapSetlists((await res.json()).setlist ?? []);
}
