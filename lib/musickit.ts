"use client";

/* Apple MusicKit — full-song playback for subscribers.
 *
 * Entirely behind NEXT_PUBLIC_MUSICKIT_DEVELOPER_TOKEN (requires an Apple
 * Developer Program membership to mint). Without the token nothing loads,
 * nothing renders, and the 30-second iTunes previews keep working as before. */

let loading: Promise<any> | null = null;

export function musicKitEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MUSICKIT_DEVELOPER_TOKEN);
}

async function loadMusicKit(): Promise<any | null> {
  if (!musicKitEnabled() || typeof window === "undefined") return null;
  const w = window as any;
  if (w.MusicKit?.getInstance) return configure(w.MusicKit);
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      s.async = true;
      s.onload = () => resolve(configure((window as any).MusicKit));
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return loading;
}

async function configure(MusicKit: any): Promise<any | null> {
  try {
    await MusicKit.configure({
      developerToken: process.env.NEXT_PUBLIC_MUSICKIT_DEVELOPER_TOKEN,
      app: { name: "heard", build: "1.0" },
    });
    return MusicKit.getInstance();
  } catch { return null; }
}

/** Authorize (Apple Music subscription required) then play a song by
 *  artist + title. Returns false if anything in the chain isn't available,
 *  so callers can fall back to the 30s preview. */
export async function playFullSong(artist: string, title: string): Promise<boolean> {
  const mk = await loadMusicKit();
  if (!mk) return false;
  try {
    if (!mk.isAuthorized) await mk.authorize();
    const result = await mk.api.music("/v1/catalog/{{storefrontId}}/search", {
      term: `${artist} ${title}`, types: "songs", limit: 1,
    });
    const song = result?.data?.results?.songs?.data?.[0];
    if (!song) return false;
    await mk.setQueue({ song: song.id });
    await mk.play();
    return true;
  } catch { return false; }
}

export async function stopFullSong(): Promise<void> {
  try { (window as any).MusicKit?.getInstance()?.stop(); } catch {}
}
