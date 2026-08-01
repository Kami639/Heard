/* One polite client for every external API.
 *
 * Each host gets a token bucket sized to that service's published limit, plus
 * exponential backoff on 429/503 and a shared response cache. Nominatim caps
 * at 1 req/s and MusicBrainz blocks IPs that exceed 1 call/second, so a single
 * unthrottled loop anywhere in the app could get us banned outright. Routing
 * everything through here makes that impossible by construction.
 */

interface Bucket {
  perSecond: number;
  tokens: number;
  last: number;
  queue: (() => void)[];
  draining: boolean;
}

const LIMITS: Record<string, number> = {
  "nominatim.openstreetmap.org": 1,   // OSM policy: absolute max 1/sec
  "musicbrainz.org": 1,               // 1/sec per IP, else 503/ban
  "en.wikipedia.org": 3,              // serial-ish; be a good citizen
  "api.setlist.fm": 2,                // standard key: 2.0/sec
  "itunes.apple.com": 3,              // ~20/min documented, keep well under
  "api.deezer.com": 5,                // ~50 per 5s reported
  "api.spotify.com": 10,
  default: 5,
};

const buckets = new Map<string, Bucket>();

function bucketFor(host: string): Bucket {
  let b = buckets.get(host);
  if (!b) {
    const perSecond = LIMITS[host] ?? LIMITS.default;
    b = { perSecond, tokens: perSecond, last: Date.now(), queue: [], draining: false };
    buckets.set(host, b);
  }
  return b;
}

function take(host: string): Promise<void> {
  const b = bucketFor(host);
  return new Promise((resolve) => {
    b.queue.push(resolve);
    if (!b.draining) drain(b);
  });
}

function drain(b: Bucket) {
  b.draining = true;
  const tick = () => {
    const now = Date.now();
    b.tokens = Math.min(b.perSecond, b.tokens + ((now - b.last) / 1000) * b.perSecond);
    b.last = now;

    while (b.tokens >= 1 && b.queue.length) {
      b.tokens -= 1;
      b.queue.shift()!();
    }
    if (b.queue.length) setTimeout(tick, Math.ceil(1000 / b.perSecond));
    else b.draining = false;
  };
  tick();
}

const cache = new Map<string, { body: string; exp: number }>();

export interface FetchOptions {
  headers?: Record<string, string>;
  /** cache successful responses for this long (ms). 0 disables. */
  ttl?: number;
  retries?: number;
}

/** Throttled, retrying, cached JSON fetch. Returns null instead of throwing. */
export async function politeJson<T = any>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  const { headers = {}, ttl = 6 * 3600 * 1000, retries = 2 } = opts;

  const hit = ttl ? cache.get(url) : undefined;
  if (hit && Date.now() < hit.exp) {
    try { return JSON.parse(hit.body) as T; } catch { cache.delete(url); }
  }

  let host = "default";
  try { host = new URL(url).host; } catch {}

  for (let attempt = 0; attempt <= retries; attempt++) {
    await take(host);
    try {
      const res = await fetch(url, {
        headers: {
          // Wikimedia/OSM/MusicBrainz all require an identifying agent
          "User-Agent": "heard-concert-archive/1.0 (https://heard-beryl.vercel.app)",
          Accept: "application/json",
          ...headers,
        },
        cache: "no-store",
      });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        const wait = retryAfter ? retryAfter * 1000 : 800 * Math.pow(2, attempt);
        if (attempt < retries) { await new Promise((r) => setTimeout(r, wait)); continue; }
        return null;
      }
      if (!res.ok) return null;

      const body = await res.text();
      if (ttl) {
        if (cache.size > 4000) cache.clear();
        cache.set(url, { body, exp: Date.now() + ttl });
      }
      return JSON.parse(body) as T;
    } catch {
      if (attempt >= retries) return null;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  return null;
}
