"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Art } from "@/components/Art";
import { MOCK_SEARCH, splitArtists, isNoteEntry, type ConcertRec } from "@/features/concerts/data";
import { COUNTRY_LIST } from "@/lib/countries";
import { addConcert, getConcerts } from "@/lib/store";
import { FEST_RE } from "@/features/achievements";
import { setPreview } from "@/lib/previewStore";

const PALETTE = [
  ["#2E4B2E", "#0E120E"], ["#7A4A2B", "#2B1A10"], ["#3A3A46", "#121216"],
  ["#8C2B2B", "#1E0A0A"], ["#6B7B8C", "#1C222A"], ["#3E6E5E", "#0E1A16"],
];
const colorsFor = (name: string) =>
  PALETTE[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PALETTE.length];

const THIS_YEAR = new Date().getFullYear();
const YEARS = ["All", ...Array.from({ length: 30 }, (_, i) => String(THIS_YEAR - i))];

interface Result {
  id: string; artist: string; tour: string; venue: string; city: string;
  dateDisplay: string; year: number; setlist: string[];
  c1: string; c2: string; initials: string; imageUrl?: string | null;
  lat?: number | null; lng?: number | null;
  cancelled?: boolean;
  artists?: { name: string; imageUrl?: string | null }[];
  covers?: Record<string, string>;
  guests?: string[];
  country?: string;
  songArtists?: Record<string, string>;
  encoreCount?: number;
  openers?: string[];
  attendance?: string | null;
  wikiSourced?: boolean;
  setlistFromWiki?: boolean;
  songGuests?: Record<string, string[]>;
}

export default function Add() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("All");
  const [country, setCountry] = useState("All");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [stype, setStype] = useState<"all" | "tour" | "festival">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [literal, setLiteral] = useState(false); // user turned off smart parsing
  const [understood, setUnderstood] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const [tourFilter, setTourFilter] = useState("All");
  const [tourOptions, setTourOptions] = useState<string[]>([]);
  const [tourCounts, setTourCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Result[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [typeahead, setTypeahead] = useState<{ name: string; imageUrl: string | null }[]>([]);
  const taTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "mock" | "none" | "cooldown" | "more">("idle");
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [lockedArtist, setLockedArtist] = useState<string | null>(null);
  const [artistTours, setArtistTours] = useState<{ artist: string; tours: string[] } | null>(null);
  const [pending, setPending] = useState<Result | null>(null);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem("heard.recent.v1") ?? "[]")); } catch {}
    const pre = new URLSearchParams(window.location.search).get("q");
    // "Add another" (and plain back-navigation) restores the whole search:
    // query, every filter, and the results you were just looking at.
    try {
      const saved = JSON.parse(sessionStorage.getItem("heard.addstate.v1") ?? "null");
      if (saved && Date.now() - saved.at < 30 * 60 * 1000) {
        if (saved.year) setYear(saved.year);
        if (saved.country) setCountry(saved.country);
        if (saved.city) setCity(saved.city);
        if (saved.venue) setVenue(saved.venue);
        if (saved.stype) setStype(saved.stype);
        if (!pre || pre === saved.q) {
          if (saved.q) setQ(saved.q);
          if (saved.results?.length) {
            setResults(saved.results);
            setStatus("live");
            restoredRef.current = true; // skip the automatic re-search once
          }
          return;
        }
      }
    } catch {}
    if (pre) setQ(pre);
  }, []);

  function saveRecent(query: string) {
    try {
      const next = [query, ...recent.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 8);
      setRecent(next);
      localStorage.setItem("heard.recent.v1", JSON.stringify(next));
    } catch {}
  }

  useEffect(() => setCount(getConcerts().length), []);

  useEffect(() => {
    if (taTimer.current) clearTimeout(taTimer.current);
    if (q.length < 2) { setTypeahead([]); }
    else {
      taTimer.current = setTimeout(async () => {
        try {
          const r = await fetch(`/api/artists?name=${encodeURIComponent(q)}`);
          const { artists } = await r.json();
          setTypeahead((artists ?? []).filter((a: any) => a.name.toLowerCase() !== q.toLowerCase()));
        } catch { setTypeahead([]); }
      }, 350);
    }
    return () => { if (taTimer.current) clearTimeout(taTimer.current); };
  }, [q]);

  useEffect(() => {
    if (restoredRef.current) { restoredRef.current = false; return; }
    if (lockedArtist && q.trim().toLowerCase() !== lockedArtist.toLowerCase()) setLockedArtist(null);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2 && !city.trim() && !venue.trim()) { setResults([]); setSuggestion(null); setStatus("idle"); setUnderstood(null); return; }
    setStatus("loading");
    setTourFilter("All");
    setTourOptions([]);
    timer.current = setTimeout(() => search(q.trim(), year, 1, false), 650);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, year, country, city, venue, stype, literal]);

  /* Light query understanding — conservative on purpose.
   *   "drake toronto 2023"  ->  q "drake toronto"  + year 2023
   *   "drake in toronto"    ->  q "drake"          + city "toronto"
   * Anything ambiguous is left alone; the server's own strategies handle it. */
  function parseQuery(raw: string): { qClean: string; autoYear?: string; autoCity?: string } {
    if (literal) return { qClean: raw };
    let qClean = raw.trim();
    let autoYear: string | undefined;
    let autoCity: string | undefined;

    const ym = qClean.match(/\s(19[5-9]\d|20[0-4]\d)$/);
    if (ym) { autoYear = ym[1]; qClean = qClean.slice(0, ym.index).trim(); }

    const im = qClean.match(/^(.{2,}?)\s+in\s+([a-zA-Z .'-]{3,})$/i);
    if (im) { qClean = im[1].trim(); autoCity = im[2].trim(); }

    return { qClean, autoYear, autoCity };
  }

  async function fetchArtistFix(query: string) {
    try {
      const r = await fetch(`/api/artist?name=${encodeURIComponent(query)}`);
      const name: string | undefined = (await r.json()).artist?.name;
      if (name && name.toLowerCase() !== query.toLowerCase()) setSuggestion(name);
      else setSuggestion(null);
    } catch { setSuggestion(null); }
  }

  async function search(query: string, yr: string, pg: number, append: boolean, tour?: string, lockOverride?: string) {
    try {
      const parsed = tour ? { qClean: query } : parseQuery(query);
      const effYear = yr !== "All" ? yr : parsed.autoYear;
      const effCity = city.trim() || parsed.autoCity;
      const params = new URLSearchParams({ p: String(pg) });
      if (tour) {
        params.set("tourName", tour);
        const hint = results.find((r) => r.tour === tour)?.artist;
        if (hint) params.set("artist", hint);
      } else if (parsed.qClean) {
        params.set("q", parsed.qClean);
      }
      if (effYear) params.set("year", effYear);
      if (country !== "All") params.set("country", country);
      if (effCity) params.set("city", effCity);
      if (venue.trim()) params.set("venue", venue.trim());
      if (stype !== "all") params.set("type", stype);
      const lock = lockOverride ?? lockedArtist;
      if (lock && !tour) {
        params.set("artist", lock);
        params.delete("q"); // exact-artist mode: no fuzzy venue/city bleed
      }
      const res = await fetch(`/api/setlist/search?${params}`);
      if (res.status === 429) {
        setStatus("cooldown");
        setTimeout(() => search(query, yr, pg, append), 2500);
        return;
      }
      if (!res.ok) throw new Error("unavailable");
      const { results: raw, matchedAs = "" } = await res.json();
      fetchArtistFix(query); // spelling check in parallel

      {
        const bits: string[] = [];
        if (!tour && parsed.qClean) bits.push(parsed.qClean);
        if (tour) bits.push(tour);
        if (effCity) bits.push(`📍 ${effCity}`);
        if (venue.trim()) bits.push(`🏟 ${venue.trim()}`);
        if (effYear) bits.push(`🗓 ${effYear}`);
        if (stype !== "all") bits.push(stype === "festival" ? "🎪 festivals only" : "tours only");
        const how: Record<string, string> = {
          artist: "artist", "artist+detail": "artist + place/tour", tour: "tour",
          "tour+place": "tour + place", place: "place", country: "country",
          structured: "your filters", interpreted: "interpreted", wikipedia: "via Wikipedia",
          event: "event",
        };
        setUnderstood(
          bits.length > 1 || matchedAs === "structured" || parsed.autoYear || parsed.autoCity
            ? `${bits.join(" · ")}${how[matchedAs] ? `  (matched: ${how[matchedAs]})` : ""}`
            : null
        );
      }

      // if this looks like an artist, offer their tours as a shortcut
      if (matchedAs === "artist" && !append) {
        fetch(`/api/tours?artist=${encodeURIComponent(query)}`)
          .then((r) => r.json())
          .then((d) => setArtistTours(d.tours?.length ? { artist: query, tours: d.tours } : null))
          .catch(() => {});
      } else if (!append) setArtistTours(null);

      if (!raw?.length) {
        if (!append) setResults([]);
        setStatus(append ? "live" : "none");
        return;
      }

      // popularity map so the "real" Drake beats Drake Milligan
      const normKey = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      let popMap: Record<string, number> = {};
      try {
        const pr = await fetch(`/api/artists?name=${encodeURIComponent(query)}`);
        for (const a of (await pr.json()).artists ?? []) popMap[normKey(a.name)] = a.popularity ?? 0;
      } catch {}

      const combos = [...new Set(raw.map((r: any) => `${r.artist}::${r.tour ?? ""}`))] as string[];
      const imgs: Record<string, string | null> = {};
      await Promise.all(combos.map(async (key) => {
        const [artist, tour] = key.split("::");
        try {
          const r = await fetch(`/api/artwork?artist=${encodeURIComponent(artist)}&tour=${encodeURIComponent(tour)}`);
          imgs[key] = (await r.json()).imageUrl ?? null;
        } catch { imgs[key] = null; }
      }));

      const mapped: Result[] = raw.map((r: any) => {
        const [c1, c2] = colorsFor(r.artist);
        const d = new Date(r.date + "T12:00:00");
        return {
          id: `slfm-${r.setlistFmId}`,
          artist: r.artist,
          tour: r.tour ?? "Live",
          venue: r.venue,
          city: r.city,
          country: r.country ?? undefined,
          songArtists: r.songArtists ?? undefined,
          encoreCount: r.setlist.filter((x: any) => x.encore).length || undefined,
          openers: r.openers ?? undefined,
          attendance: r.attendance ?? undefined,
          wikiSourced: r.wikiSourced ?? undefined,
          setlistFromWiki: r.setlistFromWiki ?? undefined,
          dateDisplay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          year: d.getFullYear(),
          setlist: r.setlist.map((s: any) => s.name).filter((n: string) => !isNoteEntry(n)),
          covers: Object.fromEntries(
            r.setlist.filter((s: any) => s.cover && !isNoteEntry(s.name)).map((s: any) => [s.name, s.cover])
          ),
          guests: [...new Set(r.setlist.map((s: any) => s.withGuest).filter(Boolean))] as string[],
          songGuests: Object.fromEntries(
            r.setlist.filter((s: any) => s.withGuest).map((s: any) => [s.name, [s.withGuest]])
          ),
          c1, c2,
          initials: r.artist[0]?.toUpperCase() ?? "?",
          imageUrl: imgs[`${r.artist}::${r.tour ?? ""}`],
          lat: r.lat, lng: r.lng,
          cancelled: r.cancelledShow || /cancel|postpon/i.test(
            `${r.tour ?? ""} ${r.info ?? ""} ${r.setlist.map((s: any) => s.name).filter(isNoteEntry).join(" ")}`
          ),
        };
      });
      if (matchedAs === "artist" || matchedAs === "interpreted" || matchedAs === "") mapped.sort((a, b) => {
        const qa = normKey(a.artist) === normKey(query) || normKey(a.artist).startsWith(normKey(query)) ? 1 : 0;
        const qb = normKey(b.artist) === normKey(query) || normKey(b.artist).startsWith(normKey(query)) ? 1 : 0;
        if (qa !== qb) return qb - qa; // exact name match first
        const pa = popMap[normKey(a.artist)] ?? -1;
        const pb = popMap[normKey(b.artist)] ?? -1;
        if (pa !== pb) return pb - pa; // then by popularity
        return +new Date(b.dateDisplay) - +new Date(a.dateDisplay); // then newest
      });
      // multi-artist enrichment: "A & B" gets both faces on the cover
      await Promise.all(mapped.map(async (m) => {
        const parts = splitArtists(m.artist);
        if (parts.length < 2) return;
        const enriched = await Promise.all(parts.map(async (name) => {
          try {
            const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
            const a = (await r.json()).artist;
            return { name, imageUrl: a?.imageUrl ?? null, popularity: a?.popularity ?? 0 };
          } catch { return { name, imageUrl: null, popularity: 0 }; }
        }));
        // headliner first: most popular leads the billing
        enriched.sort((a, b) => b.popularity - a.popularity);
        m.artists = enriched.map(({ name, imageUrl }) => ({ name, imageUrl }));
        m.artist = enriched.length > 4
          ? `${enriched.slice(0, 4).map((a) => a.name).join(" & ")} & more`
          : enriched.map((a) => a.name).join(" & ");
      }));

      setTypeahead([]);
      setTourCounts(() => {
        const counts: Record<string, number> = {};
        for (const m of mapped) if (m.tour) counts[m.tour] = (counts[m.tour] ?? 0) + 1;
        return counts;
      });
      setTourOptions((prev) => {
        const merged = new Set(prev);
        for (const m of mapped) if (m.tour && m.tour !== "Live") merged.add(m.tour);
        return [...merged];
      });
      setResults(append ? (prev) => [...prev, ...mapped] as any : mapped);
      setPage(pg);
      setStatus("live");
      if (!append) {
        try {
          sessionStorage.setItem("heard.addstate.v1", JSON.stringify({
            q: tour ? q : query, year: yr, country, city, venue, stype,
            results: mapped.slice(0, 30), at: Date.now(),
          }));
        } catch {}
      }
      if (!append && !tour && mapped.length) saveRecent(query);
    } catch {
      const mock = MOCK_SEARCH.filter((r) => r.artist.toLowerCase().includes(query.toLowerCase()));
      setResults(mock as Result[]);
      setStatus(mock.length ? "mock" : "none");
    }
  }

  const confirmAdd = (r: Result) => {
    setPreview({ ...r, rating: 5, price: 0, photos: 0, notes: "" });
    router.push("/preview");
  };

  const pick = (r: Result) => {
    const dupe = getConcerts().find((c) => c.id.startsWith(r.id));
    const c: ConcertRec = {
      ...r, id: `${r.id}-${Date.now()}`, rating: 5, price: 0, photos: 0, notes: "",
      festival: FEST_RE.test(`${r.tour} ${r.venue}`) ? r.tour : undefined,
    };
    addConcert(c);
    // enrich with genres in the background (feeds Top Genres in Wrapped)
    fetch(`/api/artist?name=${encodeURIComponent(splitArtists(r.artist)[0] ?? r.artist)}`)
      .then((res) => res.json())
      .then(({ artist }) => {
        if (artist?.genres?.length) {
          import("@/lib/store").then((m) => m.updateConcert(c.id, { genres: artist.genres.slice(0, 4) }));
        }
      })
      .catch(() => {});
    router.push(`/concert/${c.id}?added=1`);
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setQ(suggestion);
    setSuggestion(null);
  };

  return (
    <AppShell title="add" count={count}>
      <section className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-2">
        <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5">
          <Search size={18} className="shrink-0 text-sub" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.length > 1) {
                if (timer.current) clearTimeout(timer.current);
                setStatus("loading");
                search(q, year, 1, false);
              }
            }}
            placeholder='Try "drake toronto 2023" or "rolling loud"'
            className="w-full min-w-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-sub"
            autoFocus
          />
          {q && (
            <button
              onClick={() => {
                setQ(""); setResults([]); setStatus("idle"); setUnderstood(null); setLockedArtist(null);
                try { sessionStorage.removeItem("heard.addstate.v1"); } catch {}
              }}
              aria-label="Clear search"
              className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card2 text-[12px] text-sub"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-lg bg-card p-1" role="tablist" aria-label="Show type">
            {([["all", "All"], ["tour", "Tours"], ["festival", "🎪 Festivals"]] as const).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                aria-selected={stype === v}
                onClick={() => setStype(v)}
                className={`pressable flex-1 rounded-md py-1.5 text-xs font-semibold ${
                  stype === v ? "bg-accent text-black" : "text-sub"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`pressable shrink-0 rounded-lg px-3 py-2 text-sm ${
              showFilters || city || venue || year !== "All" || country !== "All"
                ? "bg-accent/15 font-semibold text-accent" : "bg-card text-sub"
            }`}
          >
            ⚙ Filters{(city ? 1 : 0) + (venue ? 1 : 0) + (year !== "All" ? 1 : 0) + (country !== "All" ? 1 : 0) > 0
              ? ` · ${(city ? 1 : 0) + (venue ? 1 : 0) + (year !== "All" ? 1 : 0) + (country !== "All" ? 1 : 0)}` : ""}
          </button>
        </div>

        {showFilters && (
          <div className="fade-up flex flex-col gap-2 rounded-xl bg-card p-3">
            <div className="flex gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (e.g. Toronto)"
                aria-label="Filter by city"
                className="min-w-0 flex-1 rounded-lg bg-card2 px-3 py-2 text-sm text-ink outline-none placeholder:text-sub"
              />
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Venue (e.g. Red Rocks)"
                aria-label="Filter by venue"
                className="min-w-0 flex-1 rounded-lg bg-card2 px-3 py-2 text-sm text-ink outline-none placeholder:text-sub"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="min-w-0 flex-1 truncate rounded-lg bg-card2 px-3 py-2 text-sm text-accent outline-none"
                aria-label="Filter by country"
              >
                <option value="All">All countries</option>
                {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24 shrink-0 rounded-lg bg-card2 px-3 py-2 text-sm text-accent outline-none"
                aria-label="Filter by year"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y === "All" ? "Year" : y}</option>)}
              </select>
            </div>
            {(city || venue || year !== "All" || country !== "All") && (
              <button
                onClick={() => { setCity(""); setVenue(""); setYear("All"); setCountry("All"); }}
                className="pressable self-start text-[11px] text-sub underline underline-offset-4"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {typeahead.length > 0 && results.length === 0 && (
          <div className="overflow-hidden rounded-2xl bg-card">
            {typeahead.map((a, i) => (
              <button
                key={a.name}
                onClick={() => {
                  setTypeahead([]);
                  setQ(a.name);
                  setLockedArtist(a.name);
                  if (timer.current) clearTimeout(timer.current);
                  setStatus("loading");
                  search(a.name, year, 1, false, undefined, a.name);
                }}
                className={`pressable flex w-full items-center gap-3 px-4 py-2.5 text-left ${i < typeahead.length - 1 ? "border-b border-hairline" : ""}`}
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card2 text-xs text-sub">
                    {a.name[0]}
                  </span>
                )}
                <span className="text-[15px]">{a.name}</span>
              </button>
            ))}
          </div>
        )}

        {suggestion && (
          <button onClick={useSuggestion} className="pressable self-start rounded-full bg-card px-4 py-2 text-sm">
            Did you mean <span className="font-semibold text-accent">{suggestion}</span>?
          </button>
        )}

        {understood && status !== "loading" && (
          <p className="fade-up px-1 text-center font-mono text-[11px] text-sub">
            {understood}
            <button onClick={() => setLiteral((v) => !v)} className="pressable pl-2 text-accent underline underline-offset-2">
              {literal ? "smart search" : "search literally"}
            </button>
          </p>
        )}
        {status === "loading" && <p className="text-center text-xs text-sub">Searching…</p>}
        {lockedArtist && (
          <div className="flex items-center gap-2 self-start rounded-full bg-accent/15 py-1.5 pl-3 pr-1.5 text-xs">
            <span>Only <span className="font-semibold text-accent">{lockedArtist}</span></span>
            <button
              onClick={() => { setLockedArtist(null); search(q.trim(), year, 1, false); }}
              aria-label="Clear artist filter"
              className="pressable flex h-5 w-5 items-center justify-center rounded-full bg-card2 text-[11px] text-sub"
            >
              ✕
            </button>
          </div>
        )}
        {status === "cooldown" && <p className="text-center text-xs text-sub">Servers are a little busy — retrying for you…</p>}
        {status === "none" && (
          <button
            onClick={() => router.push("/add/manual")}
            className="pressable mx-auto rounded-full bg-card px-4 py-2 text-sm text-accent"
          >
            ＋ Add this show manually
          </button>
        )}
        {status === "none" && (
          <p className="text-center text-xs text-sub">
            Nothing found{year !== "All" ? ` in ${year}` : ""} — try the artist alone, or artist + city.
          </p>
        )}
        {(status === "live" || status === "none") && (
          <button
            onClick={() => router.push("/add/manual")}
            className="pressable mx-auto text-[11px] text-sub underline"
          >
            Can&apos;t find it? Add manually
          </button>
        )}
        {status === "mock" && (
          <p className="text-center text-[10px] text-sub">DEMO MODE — add API keys to .env.local for live sync</p>
        )}

        {tourOptions.length > 1 && (
          <select
            value={tourFilter}
            onChange={(e) => {
              const v = e.target.value;
              setTourFilter(v);
              if (v !== "All") {
                setStatus("loading");
                search(q, year, 1, false, v); // fetch the ENTIRE tour, not just loaded shows
              } else {
                setStatus("loading");
                search(q, year, 1, false);
              }
            }}
            className="w-full min-w-0 truncate rounded-lg bg-card px-3 py-2 text-sm text-accent outline-none"
            aria-label="Filter by tour"
          >
            <option value="All">All tours</option>
            {tourOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {artistTours && (
          <div>
            <p className="pb-1.5 pl-1 text-[11px] font-semibold uppercase tracking-wide text-sub">
              {artistTours.artist}&apos;s tours
            </p>
            <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {artistTours.tours.map((t) => (
                <button
                  key={t}
                  onClick={() => router.push(`/tour/${encodeURIComponent(t)}?artist=${encodeURIComponent(artistTours.artist)}`)}
                  className="pressable min-w-[140px] snap-start rounded-xl bg-card p-3 text-left text-xs leading-tight"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {results.length > 0 && (
          <p className="pl-1 text-[11px] text-sub">
            {results.length} show{results.length === 1 ? "" : "s"}
            {tourFilter !== "All" ? ` · ${tourFilter}` : ""}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {results.map((r, ri) => (
            <button
              key={r.id}
              onClick={() => confirmAdd(r)}
              className={`pressable fade-up flex items-center gap-3 rounded-2xl bg-card p-3 text-left ${r.cancelled ? "opacity-50" : ""}`}
              style={{ animationDelay: `${Math.min(ri, 10) * 45}ms` }}
            >
              <div className="w-12 shrink-0">
                <Art c1={r.c1} c2={r.c2} initials={r.initials} imageUrl={r.imageUrl} artists={r.artists} className="rounded-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-[15px] font-semibold">{r.artist}</span>
                  {r.cancelled && (
                    <span className="shrink-0 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-semibold text-sub">CANCELLED</span>
                  )}
                  {r.wikiSourced && (
                    <span className="shrink-0 rounded-full bg-card2 px-2 py-0.5 text-[10px] font-semibold text-accent/80">WIKI</span>
                  )}
                  {FEST_RE.test(`${r.tour} ${r.venue}`) && (
                    <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">🎪</span>
                  )}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (r.tour) router.push(`/tour/${encodeURIComponent(r.tour)}?artist=${encodeURIComponent(splitArtists(r.artist)[0] ?? r.artist)}`);
                  }}
                  className="truncate text-xs text-accent/90 hover:text-accent"
                >
                  {r.tour} ▸
                </div>
                <div className="text-xs text-sub">{r.venue} · {r.city}</div>
                <div className="text-xs text-sub">{r.dateDisplay} · {r.setlist.length ? `${r.setlist.length} songs` : "no setlist yet"}</div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-accent">Add</span>
            </button>
          ))}
        </div>

        {status === "live" && results.length >= 15 && tourFilter === "All" && (
          <button
            onClick={() => { setStatus("loading"); search(q, year, page + 1, true); }}
            className="pressable mx-auto rounded-full bg-card px-5 py-2.5 text-sm text-accent"
          >
            Load more shows
          </button>
        )}

        {status === "idle" && recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between pb-2 pl-1">
              <span className="text-xs font-semibold text-sub">RECENT</span>
              <button
                onClick={() => { setRecent([]); try { localStorage.removeItem("heard.recent.v1"); } catch {} }}
                className="text-xs text-sub"
              >
                clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} onClick={() => setQ(r)} className="pressable rounded-full bg-card px-3.5 py-2 text-sm">
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
        {status === "idle" && recent.length === 0 && (
          <p className="pt-12 text-center text-sm text-sub">
            Search an artist, tour, venue or city.<br />&ldquo;drake spectrum center&rdquo;, &ldquo;antagonist tour&rdquo;, &ldquo;red rocks&rdquo;.
          </p>
        )}
        <p className="mt-auto pt-4 text-center text-[10px] text-sub">Concert data from setlist.fm & Wikipedia · Images from Spotify, Deezer & iTunes</p>
      </section>
    </AppShell>
  );
}
