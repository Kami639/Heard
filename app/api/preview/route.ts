import { NextRequest, NextResponse } from "next/server";
import { pickTrack, titleVariants, type Candidate } from "@/lib/songMatch";
import { artistCatalogue } from "@/lib/catalogue";

// Song previews with artist verification.
// Handles multi-artist billings ("Teezus & Diamond" -> try Teezus, try Diamond)
// and small spelling drift between setlist.fm and the catalogs (Teezus/Tezzus).
// Chain: iTunes -> Deezer, per artist candidate. Only "not_found" everywhere
// earns the UNRELEASED tag.

const norm = (x: string) =>
  x.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]/g, "");

// Known aliases — setlist.fm and the catalogs often disagree on names.
const ALIASES: Record<string, string[]> = {
  "hxg": ["Homixide Gang", "Homixide Gvng"],
  "homixidegang": ["Homixide Gvng", "HXG"],
  "homixidegvng": ["Homixide Gang", "HXG"],
  "nbayoungboy": ["YoungBoy Never Broke Again"],
  "youngboyneverbrokeagain": ["NBA YoungBoy"],
  "ye": ["Kanye West"],
  "kanyewest": ["Ye"],
};

function splitArtists(name: string): string[] {
  return name
    .split(/\s*(?:&|\+|,|\/)\s*|\s+(?:and|x|con)\s+/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// Archive/vault accounts: "Prada Archives", "Nine Vicious Vault", "X Leaks" —
// underground catalogs often live on these instead of the artist's own profile.
const ARCHIVE_RE = /\b(archives?|vaults?|leaks?|unreleased|snippets?|files|world)\b/gi;

function nameMatches(candidate: string, target: string): boolean {
  const na = norm(candidate), nb = norm(target);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  // fuzzy: catches Teezus/Tezzus-style drift on names 4+ chars
  if (na.length >= 4 && nb.length >= 4 && lev(na, nb) <= 2) return true;

  // archive-account rule: strip the archive-y words, then allow prefix match
  // ("prada" -> Pradabagshawty). Prefix matching ONLY on this path — it's too
  // loose for normal names (Drake would match Drake Milligan).
  if (ARCHIVE_RE.test(candidate)) {
    ARCHIVE_RE.lastIndex = 0;
    const base = norm(candidate.replace(ARCHIVE_RE, ""));
    if (base.length >= 4 && (nb.startsWith(base) || base.startsWith(nb))) return true;
    if (base.length >= 4 && nb.length >= 4 && lev(base, nb) <= 2) return true;
  }
  ARCHIVE_RE.lastIndex = 0;
  return false;
}

/** Is `cand` credited on this track as a featured artist?
 *  iTunes/Deezer put features in the TITLE ("FE!N (feat. Playboi Carti)"),
 *  not the artist field, so a strict artist check misses them entirely. */
function featuredIn(trackTitle: string, cand: string): boolean {
  const nt = norm(trackTitle), nc = norm(cand);
  if (!nt || !nc || nc.length < 4) return false;
  return /feat|ft|with|amp|and/.test(nt) ? nt.includes(nc) : false;
}

function titleMatches(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Short titles ("X", "9", "Fein") must match exactly — substring matching
  // here is what made "X" play any track with an x in the name.
  if (na.length <= 5 || nb.length <= 5) return false;
  if (na.includes(nb.slice(0, 14)) || nb.includes(na.slice(0, 14))) return true;
  return lev(na, nb) <= 2;
}

const memo = new Map<string, { v: any; exp: number }>();

export async function GET(req: NextRequest) {
  const song = req.nextUrl.searchParams.get("song");
  const artist = req.nextUrl.searchParams.get("artist") ?? "";
  const coverOf = req.nextUrl.searchParams.get("cover");
  if (!song || !artist) return NextResponse.json({ previewUrl: null, status: "not_found" });

  let candidates = [...new Set([...(coverOf ? [coverOf, ...splitArtists(coverOf)] : []), artist, ...splitArtists(artist)])];
  for (const c of [...candidates]) {
    for (const alias of ALIASES[norm(c)] ?? []) candidates.push(alias);
  }
  candidates = [...new Set(candidates)].slice(0, 5);
  const artistOk = (found: string) => candidates.some((c) => nameMatches(found, c));
  const artistOkName = artistOk;
  let trackExists = false;

  // Cache keyed by song AND artist — the same title by two artists must never
  // share a cached clip.
  const memoKey = `${norm(song)}|${norm(artist)}|${norm(coverOf ?? "")}`;
  const cached = memo.get(memoKey);
  if (cached && Date.now() < cached.exp) return NextResponse.json(cached.v);
  const respond = (payload: any) => {
    if (payload.status === "ok" || payload.status === "no_preview") {
      if (memo.size > 1500) memo.clear();
      memo.set(memoKey, { v: payload, exp: Date.now() + 6 * 3600 * 1000 });
    }
    return NextResponse.json(payload);
  };

  // Query with BOTH the stylized spelling and a plain reading of it, since
  // catalogues store one or the other ("FE!N" vs "FEIN").
  const spellings = [song, ...[...titleVariants(song)].slice(0, 2)];

  // 1) iTunes
  for (const cand of candidates) {
    for (const spelling of [...new Set(spellings)]) {
      try {
        const qs = new URLSearchParams({
          term: `${cand} ${spelling}`, media: "music", entity: "song", limit: "12",
        });
        const res = await fetch(`https://itunes.apple.com/search?${qs}`, { next: { revalidate: 604800 } });
        if (!res.ok) continue;
        const items = (await res.json()).results ?? [];
        const pool: Candidate[] = items.map((r: any) => ({
          title: r.trackName ?? "",
          artist: r.artistName ?? "",
          previewUrl: r.previewUrl ?? null,
          durationMs: r.trackTimeMillis ?? null,
        }));
        const hit = pickTrack(pool, song, candidates);
        if (hit) {
          trackExists = true;
          if (hit.previewUrl) return respond({ previewUrl: hit.previewUrl, status: "ok" });
        }
      } catch {}
    }
  }

  // 2) Deezer
  for (const cand of candidates) {
    for (const spelling of [...new Set(spellings)]) {
      try {
        const q = `artist:"${cand}" track:"${spelling}"`;
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=12`, {
          next: { revalidate: 604800 },
        });
        if (!res.ok) continue;
        const items = (await res.json()).data ?? [];
        const pool: Candidate[] = items.map((r: any) => ({
          title: r.title ?? "",
          artist: r.artist?.name ?? "",
          previewUrl: r.preview ?? null,
          durationMs: r.duration ? r.duration * 1000 : null,
        }));
        const hit = pickTrack(pool, song, candidates);
        if (hit) {
          trackExists = true;
          if (hit.previewUrl) return respond({ previewUrl: hit.previewUrl, status: "ok" });
        }
      } catch {}
    }
  }

  // 2b) Their search engines can't find a stylized title from a plain one
  // ("Fein" will never surface "FE!N"), so pull the artist's catalogue and
  // do the matching on our side.
  for (const cand of candidates.slice(0, 3)) {
    try {
      const catalogue = await artistCatalogue(cand);
      if (!catalogue.length) continue;
      const hit = pickTrack(catalogue, song, [cand]);
      if (hit) {
        trackExists = true;
        if (hit.previewUrl) return respond({ previewUrl: hit.previewUrl, status: "ok" });
      }
    } catch {}
  }

  if (trackExists) return respond({ previewUrl: null, status: "no_preview" });

  // 3) MusicBrainz — open database, no key, strong on underground releases
  for (const cand of candidates.slice(0, 2)) {
    try {
      const q = `recording:"${song}" AND artist:"${cand}"`;
      const res = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=5`,
        { headers: { "User-Agent": "heard-app/1.0 (concert archive)" }, next: { revalidate: 604800 } }
      );
      if (!res.ok) continue;
      const recs = (await res.json()).recordings ?? [];
      const hit = recs.find((r: any) =>
        titleMatches(r.title ?? "", song) &&
        (r["artist-credit"] ?? []).some((ac: any) => artistOkName(ac.name ?? ac.artist?.name ?? ""))
      );
      if (hit) return respond({ previewUrl: null, status: "no_preview" });
    } catch {}
  }

  // 4) Genius — indexes nearly everything, including SoundCloud-only drops
  const geniusToken = process.env.GENIUS_ACCESS_TOKEN;
  if (geniusToken) {
    try {
      const res = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(`${candidates[0]} ${song}`)}`,
        { headers: { Authorization: `Bearer ${geniusToken}` }, next: { revalidate: 604800 } }
      );
      if (res.ok) {
        const hits = (await res.json()).response?.hits ?? [];
        const hit = hits.find((h: any) => {
          const r = h.result ?? {};
          if (/unreleased/i.test(r.full_title ?? "")) return false; // Genius marks true leaks
          return titleMatches(r.title ?? "", song) && artistOkName(r.primary_artist?.name ?? "");
        });
        if (hit) return respond({ previewUrl: null, status: "no_preview" });
      }
    } catch {}
  }

  // 5) Cover fallback: exact title match from ANY artist. Only exact-normalized
  // equality — loose matching here would resurrect the wrong-song bug.
  try {
    const qs = new URLSearchParams({ term: song, media: "music", entity: "song", limit: "8" });
    const res = await fetch(`https://itunes.apple.com/search?${qs}`, { next: { revalidate: 604800 } });
    if (res.ok) {
      const items = (await res.json()).results ?? [];
      const exact = items.filter((r: any) => r.previewUrl && norm(r.trackName ?? "") === norm(song));
      // if any version involves someone who actually played the show, use it
      const hit =
        exact.find((r: any) => candidates.some((c) => nameMatches(r.artistName ?? "", c) || featuredIn(r.trackName ?? "", c))) ??
        exact.find((r: any) => !/karaoke|tribute|cover band|made famous|instrumental/i.test(
          `${r.artistName ?? ""} ${r.collectionName ?? ""}`
        ));
      if (hit) {
        return NextResponse.json({ previewUrl: hit.previewUrl, status: "ok", coverArtist: hit.artistName ?? null });
      }
    }
  } catch {}

  return NextResponse.json({ previewUrl: null, status: "not_found" });
}
