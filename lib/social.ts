"use client";

import { getSupabase } from "./supabase";
import { getConcerts } from "./store";
import { splitArtists, uniqueShowCount, type ConcertRec } from "@/features/concerts/data";

/* Sharing, without building a social network.
 *
 * You publish a read-only snapshot of your archive under a short code. Anyone
 * with the code can view it; nobody can edit it, and nothing is public until
 * you press publish. Friends are just codes you've saved on your own device —
 * no accounts to follow, no feed to moderate. */

const FRIENDS_KEY = "heard.friends.v1";
const CODE_KEY = "heard.mycode.v1";

export interface PublicProfile {
  code: string;
  name: string;
  shows: number;
  songs: number;
  cities: string[];
  artists: string[];
  concerts: Pick<ConcertRec, "id" | "artist" | "tour" | "venue" | "city" | "dateDisplay" | "year" | "rating">[];
  updated: string;
}

export function myCode(): string | null {
  try { return localStorage.getItem(CODE_KEY); } catch { return null; }
}

function newCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no lookalikes
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/** Publish (or refresh) your shareable snapshot. Returns the code. */
export async function publishProfile(displayName: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const code = myCode() ?? newCode();
  const cs = getConcerts().filter((c) => !c.cancelled);

  const payload: PublicProfile = {
    code,
    name: displayName || "A concert head",
    shows: uniqueShowCount(cs),
    songs: cs.reduce((n, c) => n + c.setlist.length, 0),
    cities: [...new Set(cs.map((c) => c.city))].filter(Boolean),
    artists: [...new Set(cs.flatMap((c) => splitArtists(c.artist)))].slice(0, 60),
    concerts: cs.map(({ id, artist, tour, venue, city, dateDisplay, year, rating }) =>
      ({ id, artist, tour, venue, city, dateDisplay, year, rating })),
    updated: new Date().toISOString(),
  };

  const { error } = await sb.from("shared_archives").upsert({
    code,
    user_id: session.user.id,
    data: payload,
    show_keys: cs.map((c) => showKey(c.artist, c.dateDisplay)),
    updated_at: new Date().toISOString(),
  });
  if (error) return null;

  try { localStorage.setItem(CODE_KEY, code); } catch {}
  return code;
}

export async function unpublishProfile(): Promise<void> {
  const sb = getSupabase();
  const code = myCode();
  if (!sb || !code) return;
  await sb.from("shared_archives").delete().eq("code", code);
  try { localStorage.removeItem(CODE_KEY); } catch {}
}

export async function fetchProfile(code: string): Promise<PublicProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("shared_archives").select("data").eq("code", code.toLowerCase().trim()).maybeSingle();
  if (error || !data) return null;
  return data.data as PublicProfile;
}

/* saved friends (local only) */
export function friends(): { code: string; name: string }[] {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? "[]"); } catch { return []; }
}
export function addFriend(code: string, name: string) {
  const list = friends().filter((f) => f.code !== code);
  list.unshift({ code, name });
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list.slice(0, 30))); } catch {}
}
export function removeFriend(code: string) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends().filter((f) => f.code !== code))); } catch {}
}

/** What you two have in common. */
export function overlap(theirs: PublicProfile, mine = getConcerts().filter((c) => !c.cancelled)) {
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const theirShows = new Set(theirs.concerts.map((c) => `${nk(c.artist)}|${c.dateDisplay}`));
  const theirArtists = new Set(theirs.artists.map(nk));

  return {
    sameShows: mine.filter((c) => theirShows.has(`${nk(c.artist)}|${c.dateDisplay}`)),
    sharedArtists: [...new Set(mine.flatMap((c) => splitArtists(c.artist)))].filter((a) => theirArtists.has(nk(a))),
  };
}

/* ── who else was in the room ─────────────────────────────────────────
 * Shared archives carry normalized "artist|date" keys, so a single indexed
 * containment query answers: which public profiles were at THIS show?
 * Only people who chose to publish appear — nobody is discoverable by
 * default. */

export function showKey(artist: string, dateDisplay: string): string {
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = new Date(dateDisplay);
  const iso = isNaN(+d) ? nk(dateDisplay) : d.toISOString().slice(0, 10);
  return `${nk(artist)}|${iso}`;
}

export async function whoWasThere(artist: string, dateDisplay: string):
  Promise<{ code: string; name: string; shows: number }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const key = showKey(artist, dateDisplay);
  const { data, error } = await sb
    .from("shared_archives")
    .select("code, data")
    .contains("show_keys", JSON.stringify([key]))
    .limit(20);
  if (error || !data) return [];
  const mine = myCode();
  return data
    .filter((r) => r.code !== mine)
    .map((r) => ({
      code: r.code,
      name: (r.data as PublicProfile)?.name ?? "A concert head",
      shows: (r.data as PublicProfile)?.shows ?? 0,
    }));
}
