"use client";

/* Client side of scrobble linking. The user saves a service + username in
 * profile; artist pages then show streams-vs-shows. Cached for 12h. */

const SETTINGS_KEY = "heard.scrobbles.v1";
const CACHE_KEY = "heard.scrobbles.cache.v1";

export interface ScrobbleSettings { service: "listenbrainz" | "lastfm"; user: string }

export function scrobbleSettings(): ScrobbleSettings | null {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"); } catch { return null; }
}

export function saveScrobbleSettings(s: ScrobbleSettings | null) {
  try {
    if (s) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    else { localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(CACHE_KEY); }
  } catch {}
}

const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** All-time playcounts, keyed by normalized artist name. */
export async function getPlays(force = false): Promise<Record<string, number> | null> {
  const settings = scrobbleSettings();
  if (!settings) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (!force && cached && cached.user === settings.user && Date.now() - cached.at < 12 * 3600 * 1000) {
      return cached.plays;
    }
  } catch {}
  try {
    const r = await fetch(`/api/scrobbles?service=${settings.service}&user=${encodeURIComponent(settings.user)}`);
    if (!r.ok) return null;
    const { plays } = await r.json();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), user: settings.user, plays })); } catch {}
    return plays;
  } catch { return null; }
}

export function playsFor(plays: Record<string, number> | null, artist: string): number | null {
  if (!plays) return null;
  return plays[nk(artist)] ?? null;
}
