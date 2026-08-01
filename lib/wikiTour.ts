// Tour metadata from Wikipedia — keyless, and concert tours are well covered
// there (artist, album, dates, shows, gross, attendance, opening acts).
// Success-only caching, same as every other data layer in the app.

export interface TourInfo {
  title: string;
  url: string;
  artist: string | null;
  album: string | null;
  startDate: string | null;
  endDate: string | null;
  shows: string | null;
  legs: string | null;
  gross: string | null;
  attendance: string | null;
  supportActs: string[];
  summary: string | null;
  guests: TourGuest[];
  location: string | null;
  image: string | null;
  dates: TourDate[];
  sets: TourSet[];
  prevTour: string | null;
  nextTour: string | null;
}

export interface TourDate {
  date: string;
  city: string;
  country: string | null;
  venue: string;
  openers: string[];
  attendance: string | null;
  revenue: string | null;
  cancelled?: boolean;
  reason?: string | null;
}

export interface TourSet {
  artist: string | null;
  songs: string[];
}

export interface TourGuest {
  name: string;
  host: string | null;
  places: string[];
}

import { fetchRenderedHtml, parseWikiTables } from "./wikiTables";

const cache = new Map<string, { v: TourInfo | null; exp: number }>();
const UA = { "User-Agent": "heard-concert-archive/1.0 (https://heard-beryl.vercel.app; contact via github.com/Kami639/Heard)", "Accept": "application/json" };
const API = "https://en.wikipedia.org/w/api.php";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDateTemplate(args: string): string {
  const [y, m, d] = args.split("|").map((x) => x.trim());
  if (!y) return "";
  const mi = Number(m) - 1;
  if (!m || isNaN(mi)) return y;
  return d ? `${MONTHS[mi] ?? m} ${Number(d)}, ${y}` : `${MONTHS[mi] ?? m} ${y}`;
}

/** Wikitext -> readable text. */
function clean(v: string): string {
  return v
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{\s*(?:start|end)\s+date[^|}]*\|([^}]*)\}\}/gi, (_m, g) => fmtDateTemplate(g))
    .replace(/\{\{\s*nowrap\s*\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{\s*(?:US|USD|currency)\s*\|([^}|]*)[^}]*\}\}/gi, "$$$1")
    .replace(/\{\{[\s\S]*$/g, (m) => {
      // strip templates repeatedly so nested ones ({{efn|${{Formatnum:}}}}) go too
      let out = m, prev = "";
      while (out !== prev) { prev = out; out = out.replace(/\{\{[^{}]*\}\}/g, " "); }
      return out.replace(/\{\{[\s\S]*/g, " ");
    })
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull the {{Infobox concert tour}} fields out of raw wikitext. */
function extractInfobox(wikitext: string): Record<string, string> | null {
  let start = wikitext.search(/\{\{\s*Infobox[ _]?concert[ _]?tour/i);
  if (start < 0) start = wikitext.search(/\{\{\s*Infobox/i); // some articles use variants
  if (start < 0) return null;

  let depth = 0, end = -1;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext.startsWith("{{", i)) { depth++; i++; }
    else if (wikitext.startsWith("}}", i)) { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;

  const body = wikitext.slice(start + 2, end - 2);
  const parts: string[] = [];
  let cur = "", braces = 0, brackets = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{") { braces++; cur += two; i++; continue; }
    if (two === "}}") { braces--; cur += two; i++; continue; }
    if (two === "[[") { brackets++; cur += two; i++; continue; }
    if (two === "]]") { brackets--; cur += two; i++; continue; }
    if (body[i] === "|" && braces === 0 && brackets === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);

  const out: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    out[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return out;
}

function splitActs(v: string): string[] {
  return clean(v)
    .split(/\s*·\s*|\s*\*\s*|,(?![^(]*\))/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1 && x.length < 40)
    .slice(0, 8);
}

/** Wikipedia tour articles list surprise guests as bullets:
 *  "* [[Travis Scott]] at the 1st & 2nd show in [[Toronto]], [[Ontario]]" */
function parseGuests(wikitext: string): TourGuest[] {
  const out: TourGuest[] = [];
  let host: string | null = null;
  let active = false;

  for (const raw of wikitext.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (/^==/.test(line)) { active = /guest/i.test(line); continue; }

    if (!line.startsWith("*")) {
      if (/(surprise|special) guest|brought out/i.test(line)) {
        active = true;
        const who = clean(line).match(/^(.+?)\s+(?:has|have|also|brought)/i);
        host = who ? who[1].trim() : null;
      }
      continue;
    }
    if (!active) continue;

    const links = [...line.replace(/"[^"]*"/g, " ").matchAll(/\[\[([^\]]+)\]\]/g)]
      .map((m) => m[1].split("|").pop()!.replace(/\s*\(.*?\)\s*/g, "").trim())
      .filter(Boolean);
    if (!links.length) continue;

    out.push({ name: links[0], host, places: links.slice(1) });
    if (out.length >= 60) break;
  }
  return out;
}

const COUNTRIES = /^(United States|Canada|England|Scotland|Wales|Ireland|United Kingdom|France|Germany|Spain|Italy|Netherlands|Belgium|Sweden|Norway|Denmark|Switzerland|Austria|Portugal|Poland|Japan|South Korea|China|Australia|New Zealand|Brazil|Mexico|Argentina|Chile|Colombia|South Africa|India|Singapore|Puerto Rico|UAE|United Arab Emirates)$/i;
const MONTH_RE = "January|February|March|April|May|June|July|August|September|October|November|December";
// year optional — many tables put it in the caption instead of each row
const DATE_RE = new RegExp(`\\b(?:${MONTH_RE})\\s+\\d{1,2}\\b|\\b\\d{1,2}\\s+(?:${MONTH_RE})\\b`, "i");
const VENUE_RE = /arena|stadium|center|centre|theat|hall|bowl|park|forum|dome|coliseum|club|amphitheat|garden|field|pavilion|auditorium|palace|hippodrome/i;

const PLACEHOLDER = /^(?:—|–|-|n\/a|—?n\/a|\?|tba|tbd|—n\/a)$/i;

const COL = {
  date: /date/, city: /city/, country: /country/, venue: /venue/,
  openers: /opening|support/, attendance: /attendance|tickets/, revenue: /revenue|gross/,
};

/** Tour dates from RENDERED HTML: MediaWiki resolves rowspans and templates
 *  for us, so multi-night runs and odd venue names parse correctly. */
function datesFromHtml(html: string): TourDate[] {
  const tables = parseWikiTables(html);
  const out: TourDate[] = [];
  const cancelled: TourDate[] = [];

  for (const t of tables) {
    const idx = (re: RegExp) => t.headers.findIndex((h) => re.test(h));
    const iDate = idx(COL.date);
    if (iDate < 0) continue;

    const iCity = idx(COL.city), iCountry = idx(COL.country), iVenue = idx(COL.venue);
    const iOpen = idx(COL.openers), iAtt = idx(COL.attendance), iRev = idx(COL.revenue);
    const isCancelled = /cancel/i.test(`${t.caption} ${t.headers.join(" ")}`);
    // "List of 2022 concerts" / "Date (2022)" gives the year for month-day rows
    const yearHint = (`${t.caption} ${t.headers[iDate] ?? ""}`.match(/\b(19|20)\d{2}\b/) ?? [])[0];

    const val = (row: string[], i: number) => {
      const v = (i >= 0 ? row[i] : "")?.trim() ?? "";
      return v && !PLACEHOLDER.test(v) ? v : "";
    };

    for (const row of t.rows) {
      let date = val(row, iDate);
      if (!date || !/\d/.test(date)) continue;
      if (/^total/i.test(date)) continue;
      if (!/\d{4}/.test(date) && yearHint) date = `${date}, ${yearHint}`;

      const rec: TourDate = {
        date,
        city: val(row, iCity),
        country: val(row, iCountry) || null,
        venue: val(row, iVenue),
        openers: val(row, iOpen)
          ? val(row, iOpen).split(/\s*(?:·|,|\/)\s*|(?<=[a-z])(?=[A-Z])/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 40)
          : [],
        attendance: val(row, iAtt) || null,
        revenue: val(row, iRev) || null,
      };
      if (isCancelled) {
        rec.cancelled = true;
        rec.reason = row[row.length - 1]?.trim() || null;
        cancelled.push(rec);
      } else out.push(rec);
    }
  }

  const seen = new Set<string>();
  return [...out, ...cancelled].filter((r) => {
    const k = `${r.date}|${r.city}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Parse per-artist set lists (bolded "<name> set" headings followed by # items). */
function parseSets(wikitext: string): TourSet[] {
  const idx = wikitext.search(/==+\s*Set ?list/i);
  if (idx < 0) return [];
  const section = wikitext.slice(idx, idx + 9000).split(/\n==[^=]/)[0];

  const sets: TourSet[] = [];
  let current: TourSet | null = null;
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(?:'''|;)\s*(.+?)\s*(?:'''|:)?\s*$/);
    if (heading && !line.startsWith("#") && /set$/i.test(clean(heading[1]))) {
      current = { artist: clean(heading[1]).replace(/\s+set$/i, ""), songs: [] };
      sets.push(current);
      continue;
    }
    if (!line.startsWith("#")) continue;
    const song = clean(line.replace(/^#+\s*/, ""))
      .replace(/"/g, "")
      .replace(/\s*\/\s*/g, " / ")
      .trim();
    if (!song) continue;
    if (!current) { current = { artist: null, songs: [] }; sets.push(current); }
    current.songs.push(song);
  }
  return sets.filter((x) => x.songs.length).slice(0, 8);
}

/** Last few failures, surfaced through /api/tour?debug=1 so problems are
 *  visible instead of silently becoming "no tour details found". */
export const wikiTrace: { step: string; detail: string; at: number }[] = [];
function trace(step: string, detail: string) {
  wikiTrace.unshift({ step, detail, at: Date.now() });
  if (wikiTrace.length > 12) wikiTrace.pop();
}

async function getJson(url: string, attempt = 0): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) {
      trace("http", `${res.status} ${url.slice(0, 120)}`);
      if ((res.status === 429 || res.status >= 500) && attempt < 1) {
        await new Promise((r) => setTimeout(r, 600));
        return getJson(url, attempt + 1);
      }
      return null;
    }
    const data = await res.json();
    if (data?.error) { trace("api-error", JSON.stringify(data.error).slice(0, 160)); return null; }
    return data;
  } catch (e: any) {
    trace("fetch-threw", String(e?.message ?? e).slice(0, 160));
    return null;
  }
}

/** Find a tour's Wikipedia article and parse it. `artist` narrows the search. */
export async function fetchTourInfo(name: string, artist?: string | null): Promise<TourInfo | null> {
  const key = `${name}|${artist ?? ""}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;

  const qs = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${name} ${artist ?? ""} concert tour`.trim(),
    gsrlimit: "4",
    prop: "extracts|pageimages|categories",
    cllimit: "max",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    piprop: "thumbnail",
    pithumbsize: "800",
    format: "json",
  });
  const searchData = await getJson(`${API}?${qs}`);
  const pages = Object.values(searchData?.query?.pages ?? {}) as any[];
  if (!pages.length) { trace("no-search-results", `${name} | ${artist ?? ""}`); return null; }

  // Prefer titles that look like the tour we asked for.
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = nk(name);
  // WikiProject Concerts categorises these ("Category:2025 concert tours",
  // "Category:<Artist> concert tours") — that beats guessing from the title.
  const isTourCat = (p: any) =>
    (p.categories ?? []).some((c: any) => /concert tours?|concert residenc/i.test(c.title ?? ""));

  const ranked = pages.sort((a, b) => {
    const score = (p: any) => {
      const t = nk(p.title ?? "");
      const cat = isTourCat(p) ? 0 : 4;
      if (t === want) return cat;
      if (t.includes(want) || want.includes(t)) return cat + 1;
      if (/tour/i.test(p.title ?? "")) return cat + 2;
      return cat + 3;
    };
    return score(a) - score(b) || (a.index ?? 9) - (b.index ?? 9);
  });

  for (const page of ranked.slice(0, 2)) {
    const parseData = await getJson(
      `${API}?${new URLSearchParams({
        action: "parse", page: page.title, prop: "wikitext", format: "json", redirects: "1",
      })}`
    );
    const wikitext: string = parseData?.parse?.wikitext?.["*"] ?? "";
    const html = await fetchRenderedHtml(page.title);
    if (!wikitext) { trace("no-wikitext", page.title); continue; }
    const box = extractInfobox(wikitext) ?? {};
    // Even without a parseable infobox, a real tour article still gives us
    // dates, set lists, guests and a summary — show those rather than nothing.
    const isSingleEvent = /halftime show|super bowl|world cup|residency|benefit concert/i.test(page.title);
    const isTour = isTourCat(page) || isSingleEvent || /tour/i.test(page.title) ||
      /concert tour|tour by /i.test(wikitext.slice(0, 1500));
    if (!isTour) { trace("not-a-tour", page.title); continue; }

    // Guard against Wikipedia handing back a famous unrelated tour when the
    // real one has no article: the page must match the artist or the name.
    const boxArtist = box.artist ? clean(box.artist) : "";
    const lead = wikitext.slice(0, 1200);
    const artistOk = artist
      ? nk(boxArtist).includes(nk(artist)) || nk(artist).includes(nk(boxArtist)) ||
        new RegExp(artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(lead)
      : false;

    const GENERIC = new Set(["tour", "the", "world", "live", "concert", "stadium", "arena", "trek"]);
    const tokens = (x: string) => new Set(
      x.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !GENERIC.has(t))
    );
    const wantTok = tokens(name), gotTok = tokens(page.title);
    const nameOverlap = [...wantTok].some((t) => gotTok.has(t));

    if (!artistOk && !nameOverlap) { trace("artist-mismatch", `${page.title} vs ${artist ?? "?"}`); continue; }

    const info: TourInfo = {
      title: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      artist: box.artist ? clean(box.artist) : null,
      album: box.album ? clean(box.album) : null,
      startDate: box.start_date ? clean(box.start_date) : null,
      endDate: box.end_date ? clean(box.end_date) : null,
      shows: box.number_of_shows ? clean(box.number_of_shows) : box.shows ? clean(box.shows) : null,
      legs: box.number_of_legs ? clean(box.number_of_legs) : box.legs ? clean(box.legs) : null,
      gross: box.gross ? clean(box.gross) : null,
      attendance: box.attendance ? clean(box.attendance) : null,
      supportActs: box.support_acts ? splitActs(box.support_acts)
        : box.support_act ? splitActs(box.support_act)
        : box.opening_act ? splitActs(box.opening_act) : [],
      summary: page.extract ? String(page.extract).slice(0, 320) : null,
      guests: parseGuests(wikitext),
      location: box.location ? clean(box.location) : null,
      image: page.thumbnail?.source ?? null,
      dates: (() => {
        const rows = html ? datesFromHtml(html) : [];
        if (rows.length) return rows;
        // one-off events (a halftime show) have no dates table — build the
        // single date from the infobox instead
        const when = box.date ? clean(box.date) : box.start_date ? clean(box.start_date) : null;
        if (!when) return [];
        return [{
          date: when,
          city: box.location ? clean(box.location).split(",")[0].trim() : "",
          country: null,
          venue: box.venue ? clean(box.venue) : box.location ? clean(box.location) : "",
          openers: box.support_acts ? splitActs(box.support_acts) : [],
          attendance: box.attendance ? clean(box.attendance) : null,
          revenue: null,
        }];
      })(),
      sets: parseSets(wikitext),
      prevTour: box.last_tour ? clean(box.last_tour) : null,
      nextTour: box.next_tour ? clean(box.next_tour) : null,
    };

    if (cache.size > 500) cache.clear();
    cache.set(key, { v: info, exp: Date.now() + 7 * 24 * 3600 * 1000 });
    return info;
  }
  trace("exhausted", `${name}: nothing usable in top results`);
  return null;
}

const imgCache = new Map<string, { v: string | null; exp: number }>();

/** Just the tour's lead image (the promo poster) — cheap, cached, keyless. */
export async function fetchTourImage(name: string, artist?: string | null): Promise<string | null> {
  const key = `${name}|${artist ?? ""}`.toLowerCase();
  const hit = imgCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;

  const qs = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${name} ${artist ?? ""} concert tour`.trim(),
    gsrlimit: "3",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "800",
    format: "json",
  });
  const data = await getJson(`${API}?${qs}`);
  const pages = (Object.values(data?.query?.pages ?? {}) as any[])
    .filter((p) => /tour/i.test(p.title ?? ""))
    .sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
  const url = pages.find((p) => p.thumbnail?.source)?.thumbnail?.source ?? null;
  if (url) {
    if (imgCache.size > 800) imgCache.clear();
    imgCache.set(key, { v: url, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  }
  return url;
}

const tourListCache = new Map<string, { v: string[]; exp: number }>();

/** Every tour an artist has an article for, via "Category:<Artist> concert tours". */
export async function fetchArtistTours(artist: string): Promise<string[]> {
  const key = artist.toLowerCase();
  const hit = tourListCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;

  const out = new Set<string>();
  for (const cat of [`Category:${artist} concert tours`, `Category:${artist} tours`]) {
    const qs = new URLSearchParams({
      action: "query", list: "categorymembers", cmtitle: cat,
      cmlimit: "50", cmtype: "page", format: "json", redirects: "1",
    });
    const data = await getJson(`${API}?${qs}`);
    for (const m of data?.query?.categorymembers ?? []) {
      if (m.title && !/^(List|Category)/i.test(m.title)) out.add(m.title);
    }
    if (out.size) break;
  }
  // Categories miss co-headlining and supporting slots — the artist's own
  // article lists those under a "Tours" section.
  try {
    const parse = await getJson(
      `${API}?${new URLSearchParams({
        action: "parse", page: artist, prop: "wikitext", format: "json", redirects: "1",
      })}`
    );
    const wikitext: string = parse?.parse?.wikitext?.["*"] ?? "";
    const idx = wikitext.search(/==+\s*(?:Concert )?[Tt]ours\s*==+/);
    if (idx >= 0) {
      const section = wikitext.slice(idx, idx + 4000).split(/\n==[^=]/)[0];
      for (const line of section.split("\n")) {
        if (!line.trim().startsWith("*")) continue;
        const link = line.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
        if (link && /tour|show|vs\.|festival|residency/i.test(link[1])) out.add(link[1].trim());
      }
    }
  } catch {}

  const list = [...out].sort();
  if (list.length) {
    if (tourListCache.size > 500) tourListCache.clear();
    tourListCache.set(key, { v: list, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  }
  return list;
}
