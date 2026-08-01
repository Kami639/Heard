import { NextRequest, NextResponse } from "next/server";
import {
  searchSetlists, searchArtistCandidates, artistSetlists, type SetlistResult,
} from "@/lib/setlistfm";
import { fetchTourInfo, type TourInfo } from "@/lib/wikiTour";
import { interpretQuery } from "@/lib/aiSearch";
import { COUNTRY_CODES } from "@/lib/countries";

/* ────────────────────────────────────────────────────────────────────────────
   SEARCH — intent first, then one precise lookup.

   The old version fired artist+tour+venue+city searches at once and filtered
   afterwards with a substring test, which is why "Drake" returned Drake
   Milligan, Eleni Drake and a bar called The Drake. Here we decide what the
   query MEANS, then use exact identifiers (MusicBrainz ids) to fetch it.

   Strategy order (first one that produces results wins):
     1. exact artist            "drake"
     2. tour name               "antagonist tour", "some special shows 4 u"
     3. artist + tour/city      "iaab drake", "drake charlotte"
     4. venue or city           "red rocks", "charlotte"
     5. country                 "japan"
     6. Claude's interpretation (verified against setlist.fm)
     7. Wikipedia tour dates    (shows that setlist.fm simply doesn't have)
   ──────────────────────────────────────────────────────────────────────── */

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (x: string) => x.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const GENERIC = new Set(["tour", "live", "world", "fest", "festival", "the", "show", "shows", "concert", "trek", "a", "an", "of"]);

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Same artist? Exact after normalising, or one tiny typo. Never substring —
 *  that is precisely how "drake" used to match "drakemilligan". */
function sameArtist(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.length >= 5 && nb.length >= 5 && lev(na, nb) <= 1;
}

/** Tour names get more slack — setlist.fm and Wikipedia phrase them differently. */
function sameTour(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(words(a).filter((w) => !GENERIC.has(w)));
  const tb = words(b).filter((w) => !GENERIC.has(w));
  if (!ta.size || !tb.length) return false;
  const hits = tb.filter((w) => ta.has(w)).length;
  return hits >= Math.min(ta.size, tb.length); // every meaningful word present
}

/** Venue/city match that survives typos and missing "The": each meaningful
 *  word of the query must appear in the field, allowing one typo per word. */
function samePlace(field: string, query: string): boolean {
  const nf = norm(field), nq = norm(query);
  if (!nf || !nq) return false;
  if (nf.includes(nq) || nq.includes(nf)) return true;
  const fw = words(field).filter((w) => !GENERIC.has(w));
  const qw = words(query).filter((w) => !GENERIC.has(w));
  if (!qw.length || !fw.length) return false;
  return qw.every((q2) => fw.some((f) => f === q2 || (q2.length >= 5 && lev(f, q2) <= 1)));
}

function initials(name: string): string[] {
  const ws = name.split(/[\s:\-–—]+/).filter(Boolean);
  const all = ws.map((w) => w.replace(/[^a-zA-Z0-9]/g, "")[0] ?? "").join("").toLowerCase();
  const trimmed = ws.filter((w) => !GENERIC.has(w.toLowerCase()))
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "")[0] ?? "").join("").toLowerCase();
  return [...new Set([all, trimmed])].filter((x) => x.length >= 2);
}

/* ── artist resolution (cached) ─────────────────────────────────────────── */

const artistCache = new Map<string, { v: { mbid: string; name: string } | null; exp: number }>();

async function resolveArtist(name: string): Promise<{ mbid: string; name: string } | null> {
  const key = norm(name);
  if (!key) return null;
  const hit = artistCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;

  let out: { mbid: string; name: string } | null = null;
  try {
    const cands = await searchArtistCandidates(name);
    out = cands.find((c) => sameArtist(c.name, name)) ?? null;
  } catch {}
  if (artistCache.size > 500) artistCache.clear();
  artistCache.set(key, { v: out, exp: Date.now() + 6 * 3600 * 1000 });
  return out;
}

async function showsForArtist(mbid: string, pages = 1, startPage = 1): Promise<SetlistResult[]> {
  const out: SetlistResult[] = [];
  for (let p = startPage; p < startPage + pages; p++) {
    try {
      const rows = await artistSetlists(mbid, p);
      out.push(...rows);
      if (rows.length < 20) break;
    } catch { break; }
  }
  return out;
}

/* ── merging (unchanged behaviour, one event = one show) ────────────────── */

function mergeSameEvent(rs: SetlistResult[]): SetlistResult[] {
  const map = new Map<string, SetlistResult>();
  const bill = new Map<string, { name: string; songs: number }[]>();

  for (const r of rs) {
    const k = `${norm(r.venue)}|${r.date}`;
    const ex = map.get(k);
    if (!ex) {
      map.set(k, { ...r, setlist: [...r.setlist], songArtists: Object.fromEntries(r.setlist.map((s) => [s, r.artist])) });
      bill.set(k, [{ name: r.artist, songs: r.setlist.length }]);
      continue;
    }
    if ((bill.get(k) ?? []).some((a) => norm(a.name) === norm(r.artist))) continue;
    bill.get(k)!.push({ name: r.artist, songs: r.setlist.length });
    ex.setlist = [...ex.setlist, ...r.setlist];
    ex.songArtists = { ...(ex.songArtists ?? {}), ...Object.fromEntries(r.setlist.map((s) => [s, r.artist])) };
    ex.tour = ex.tour ?? r.tour;
    ex.lat = ex.lat ?? r.lat;
    ex.lng = ex.lng ?? r.lng;
  }

  // same date+city+tour, different venue spelling
  const byCity = new Map<string, string>();
  for (const [k, ev] of [...map]) {
    if (!ev.tour) continue;
    const ck = `${norm(ev.city)}|${ev.date}|${norm(ev.tour)}`;
    const first = byCity.get(ck);
    if (!first) { byCity.set(ck, k); continue; }
    const target = map.get(first);
    if (!target) continue;
    for (const act of bill.get(k) ?? []) {
      if (!(bill.get(first) ?? []).some((a) => norm(a.name) === norm(act.name))) bill.get(first)!.push(act);
    }
    target.setlist = [...target.setlist, ...ev.setlist];
    target.songArtists = { ...(target.songArtists ?? {}), ...(ev.songArtists ?? {}) };
    map.delete(k);
  }

  for (const [k, acts] of bill) {
    const ev = map.get(k);
    if (!ev || acts.length < 2) continue;
    const ranked = [...acts].sort((a, b) => b.songs - a.songs).map((a) => a.name);
    ev.artist = ranked.length > 4 ? `${ranked.slice(0, 4).join(" & ")} & more` : ranked.join(" & ");
  }
  return [...map.values()];
}

/* ── Wikipedia shows (last resort) ──────────────────────────────────────── */

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function toIso(dateStr: string): string | null {
  const m = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  const m2 = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m2 && MONTHS[m2[2].toLowerCase()]) return `${m2[3]}-${MONTHS[m2[2].toLowerCase()]}-${m2[1].padStart(2, "0")}`;
  return null;
}

function showsFromWikipedia(info: TourInfo): SetlistResult[] {
  const songs = info.sets.flatMap((set) => set.songs.map((name) => ({ name, encore: false, cover: null, withGuest: null })));
  // keep provenance: each artist's set stays credited to that artist
  const songArtists: Record<string, string> = {};
  for (const set of info.sets) {
    for (const name of set.songs) {
      if (set.artist) songArtists[name] = set.artist;
    }
  }
  const slug = norm(info.title);
  return info.dates.map((d, i) => {
    const iso = toIso(d.date);
    if (!iso) return null;
    return {
      setlistFmId: `wiki-${slug}-${i}`,
      artist: (info.artist ?? "").split(/\s*(?:&|,|\band\b)\s*/i)[0]?.trim() || info.title,
      tour: info.title,
      venue: d.venue || "Unknown venue",
      city: d.city,
      country: d.country ?? "",
      date: iso,
      setlist: songs,
      songArtists: Object.keys(songArtists).length ? songArtists : undefined,
      lat: null, lng: null,
      info: d.cancelled
        ? `Cancelled${d.reason ? ` — ${d.reason}` : ""}`
        : "Set list from Wikipedia — representative of this tour, not this exact night.",
      openers: d.openers,
      attendance: d.attendance,
      wikiSourced: true,
      cancelledShow: Boolean(d.cancelled),
    } as SetlistResult;
  }).filter(Boolean) as SetlistResult[];
}

/** setlist.fm often has the show but nobody submitted the songs. If the tour
 *  has a Wikipedia article with a representative set list, use that (clearly
 *  labelled) instead of showing "no setlist yet". */
async function fillMissingSetlists(rows: SetlistResult[]): Promise<SetlistResult[]> {
  const missing = rows.filter((r) => r.setlist.length === 0 && r.tour);
  if (!missing.length) return rows;

  const tours = [...new Set(missing.map((r) => r.tour!))].slice(0, 3);
  const byTour = new Map<string, { name: string; encore: boolean; cover: null; withGuest: null }[]>();

  await Promise.all(tours.map(async (t) => {
    try {
      const artistHint = missing.find((r) => r.tour === t)?.artist;
      const info = await fetchTourInfo(t, artistHint);
      const songs = (info?.sets ?? []).flatMap((set) =>
        set.songs.map((name) => ({ name, encore: false, cover: null, withGuest: null }))
      );
      if (songs.length) byTour.set(norm(t), songs);
    } catch {}
  }));

  return rows.map((r) => {
    if (r.setlist.length || !r.tour) return r;
    const songs = byTour.get(norm(r.tour));
    return songs ? { ...r, setlist: songs, setlistFromWiki: true } : r;
  });
}

/* ── route ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const artistLock = sp.get("artist");
  const tourQ = sp.get("tourName");
  const year = sp.get("year") ?? undefined;
  const country = sp.get("country") ?? undefined;
  const page = Number(sp.get("p") ?? "1");

  if (!q && !artistLock && !tourQ) {
    return NextResponse.json({ error: "q, artist or tourName required" }, { status: 400 });
  }

  const applyFilters = (rows: SetlistResult[]) => {
    let out = rows;
    if (year) out = out.filter((r) => r.date.startsWith(year));
    if (country) out = out.filter((r) => r.country === country);
    return out;
  };

  const finish = async (rows: SetlistResult[], matchedAs: string) => {
    const merged = mergeSameEvent(applyFilters(rows))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 60);
    return NextResponse.json({ results: await fillMissingSetlists(merged), matchedAs });
  };

  try {
    /* explicit modes ---------------------------------------------------- */
    if (artistLock && !q) {
      const a = await resolveArtist(artistLock);
      if (a) return await finish(await showsForArtist(a.mbid, year ? 3 : 1, page), "artist");
      return await finish(await searchSetlists({ artistName: artistLock, tourName: tourQ ?? undefined, year, countryCode: country, p: page }), "artist");
    }
    if (tourQ) {
      return await finish(await searchSetlists({ tourName: tourQ, artistName: artistLock ?? undefined, year, countryCode: country, p: page }), "tour");
    }

    const toks = q.split(/\s+/).filter(Boolean);

    /* 1 ── exact artist -------------------------------------------------- */
    const asArtist = await resolveArtist(q);
    if (asArtist) {
      const rows = await showsForArtist(asArtist.mbid, year ? 3 : 1, page);
      if (rows.length) return await finish(rows, "artist");
    }

    /* 1b ── halftime shows & one-off events ------------------------------ */
    if (/halftime|super ?bowl|world cup|grammy|vma|coachella set/i.test(q)) {
      const ev = await fetchTourInfo(q).catch(() => null);
      if (ev?.dates?.length) return await finish(showsFromWikipedia(ev), "event");
    }

    /* 2 ── tour name (Wikipedia knows whose tour it is) ------------------- */
    let tourInfo: TourInfo | null = null;
    if (toks.length >= 2) {
      try { tourInfo = await fetchTourInfo(q); } catch {}
      if (tourInfo?.artist) {
        const acts = tourInfo.artist.split(/\s*(?:&|,|\band\b|\/)\s*/i).map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 3);
        const collected: SetlistResult[] = [];
        await Promise.all(acts.map(async (act) => {
          const a = await resolveArtist(act);
          if (!a) return;
          // Ask setlist.fm for the WHOLE tour (server-side, paginated) rather
          // than scanning an artist's most recent shows — that only ever
          // surfaced the last few dates.
          for (let p = 1; p <= 3; p++) {
            const rows = await searchSetlists({ artistName: a.name, tourName: tourInfo!.title, p }).catch(() => []);
            collected.push(...rows.filter((r) => sameArtist(r.artist, a.name)));
            if (rows.length < 20) break;
          }
          // Backup: the tour string on setlist.fm sometimes differs slightly
          if (!collected.length) {
            const recent = await showsForArtist(a.mbid, 3);
            collected.push(...recent.filter((r) => r.tour && sameTour(r.tour, tourInfo!.title)));
          }
        }));

        // Fill in nights setlist.fm simply doesn't have, so a tour search
        // returns the entire tour.
        if (tourInfo.dates?.length) {
          const have = new Set(collected.map((r) => r.date));
          for (const w of showsFromWikipedia(tourInfo)) {
            if (!have.has(w.date)) collected.push(w);
          }
        }
        if (collected.length) {
          // The query may carry a place on top of the tour name
          // ("its all a blur charlotte") — honour it.
          const titleWords = new Set(words(tourInfo.title));
          const leftover = toks
            .map((t) => t.toLowerCase())
            .filter((t) => !titleWords.has(t) && !GENERIC.has(t));
          if (leftover.length) {
            const place = leftover.join(" ");
            const narrowed = collected.filter(
              (r) => samePlace(r.city, place) || samePlace(r.venue, place)
            );
            if (narrowed.length) return await finish(narrowed, "tour+place");
          }
          return await finish(collected, "tour");
        }
      }
      // a tour name that setlist.fm tags but Wikipedia doesn't know
      const byTour = await searchSetlists({ tourName: q, year, countryCode: country, p: page });
      const tight = byTour.filter((r) => r.tour && sameTour(r.tour, q));
      if (tight.length) return await finish(tight, "tour");
    }

    /* 3 ── artist + (tour | city | acronym) ------------------------------ */
    if (toks.length >= 2) {
      for (let cut = toks.length - 1; cut >= 1; cut--) {
        const left = toks.slice(0, cut).join(" ");
        const right = toks.slice(cut).join(" ");
        for (const [nameSide, otherSide] of [[left, right], [right, left]] as const) {
          const a = await resolveArtist(nameSide);
          if (!a) continue;
          const other = otherSide.trim();
          const acr = norm(other);

          // Let setlist.fm do the filtering: an artist's whole history is far
          // more than the couple of pages we could page through here, so
          // "Drake Spectrum Center" (2023) would otherwise be out of range.
          const [byVenue, byCity, byTour] = await Promise.all([
            searchSetlists({ artistName: a.name, venueName: other, year, countryCode: country }).catch(() => []),
            searchSetlists({ artistName: a.name, cityName: other, year, countryCode: country }).catch(() => []),
            searchSetlists({ artistName: a.name, tourName: other, year, countryCode: country }).catch(() => []),
          ]);
          const serverHits = [...byVenue, ...byCity, ...byTour]
            .filter((r) => sameArtist(r.artist, a.name));
          if (serverHits.length) return await finish(serverHits, "artist+detail");

          // Fallback for typos ("Filmore") and tour acronyms ("iaab"), which
          // the API can't match itself — scan the artist's recent shows.
          const rows = await showsForArtist(a.mbid, 4);
          const hits = rows.filter((r) => {
            if (r.venue && samePlace(r.venue, other)) return true;
            if (r.city && samePlace(r.city, other)) return true;
            if (r.tour && sameTour(r.tour, other)) return true;
            if (r.tour && initials(r.tour).some((i) => i === acr)) return true;
            return false;
          });
          if (hits.length) return await finish(hits, "artist+detail");
        }
      }
    }

    /* 4 ── venue / city -------------------------------------------------- */
    const [byVenue, byCity] = await Promise.all([
      searchSetlists({ venueName: q, year, countryCode: country, p: page }).catch(() => []),
      searchSetlists({ cityName: q, year, countryCode: country, p: page }).catch(() => []),
    ]);
    const places = [
      ...byVenue.filter((r) => samePlace(r.venue, q)),
      ...byCity.filter((r) => samePlace(r.city, q)),
    ];
    if (places.length) return await finish(places, "place");

    /* 5 ── country ------------------------------------------------------- */
    const cc = COUNTRY_CODES[q.toLowerCase()];
    if (cc && !country) {
      const rows = await searchSetlists({ countryCode: cc, year, p: page });
      if (rows.length) return await finish(rows, "country");
    }

    /* 6 ── Claude interprets, setlist.fm verifies ------------------------- */
    const guess = await interpretQuery(q).catch(() => null);
    if (guess?.artist) {
      const a = await resolveArtist(guess.artist);
      if (a) {
        const rows = await showsForArtist(a.mbid, 2);
        const filtered = guess.tour ? rows.filter((r) => r.tour && sameTour(r.tour, guess.tour!)) : rows;
        if (filtered.length) return await finish(filtered, "interpreted");
        if (rows.length) return await finish(rows, "interpreted");
      }
    }
    if (guess?.tour && !tourInfo) {
      try { tourInfo = await fetchTourInfo(guess.tour); } catch {}
    }

    /* 7 ── Wikipedia tour dates ------------------------------------------ */
    if (tourInfo?.dates?.length) {
      return await finish(showsFromWikipedia(tourInfo), "wikipedia");
    }

    return NextResponse.json({ results: [], matchedAs: "none" });
  } catch (e: any) {
    if (e?.rateLimited) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    return NextResponse.json({ error: "setlist.fm unavailable" }, { status: 502 });
  }
}
