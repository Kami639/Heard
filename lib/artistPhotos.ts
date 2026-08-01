"use client";

/* Small shared cache of artist photos, so avatars appear on the songs list
 * without every page re-fetching the same faces. */

const KEY = "heard.artistpics.v1";
let mem: Record<string, string> | null = null;

function read(): Record<string, string> {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { mem = {}; }
  return mem!;
}

export function cachedPhoto(name: string): string | undefined {
  return read()[name.toLowerCase()];
}

export async function fetchPhotos(names: string[]): Promise<boolean> {
  const store = read();
  const missing = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    .filter((n) => !store[n.toLowerCase()])
    .slice(0, 6);
  if (!missing.length) return false;

  await Promise.all(missing.map(async (name) => {
    try {
      const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
      const url = (await r.json()).artist?.imageUrl;
      if (url) store[name.toLowerCase()] = url;
    } catch {}
  }));
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
  return true;
}

/** Alias used by pages that pre-warm a batch of faces. */
export const warmPhotos = fetchPhotos;
