"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Art } from "@/components/Art";
import { MOCK_SEARCH, type ConcertRec } from "@/features/concerts/data";
import { addConcert, getConcerts } from "@/lib/store";

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
}

export default function Add() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("All");
  const [tourFilter, setTourFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Result[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [typeahead, setTypeahead] = useState<{ name: string; imageUrl: string | null }[]>([]);
  const taTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "mock" | "none" | "cooldown" | "more">("idle");
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

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
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setSuggestion(null); setStatus("idle"); return; }
    setStatus("loading");
    setTourFilter("All");
    timer.current = setTimeout(() => search(q, year, 1, false), 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, year]);

  async function fetchArtistFix(query: string) {
    try {
      const r = await fetch(`/api/artist?name=${encodeURIComponent(query)}`);
      const name: string | undefined = (await r.json()).artist?.name;
      if (name && name.toLowerCase() !== query.toLowerCase()) setSuggestion(name);
      else setSuggestion(null);
    } catch { setSuggestion(null); }
  }

  async function search(query: string, yr: string, pg: number, append: boolean) {
    try {
      const params = new URLSearchParams({ p: String(pg), q: query });
      if (yr !== "All") params.set("year", yr);
      const res = await fetch(`/api/setlist/search?${params}`);
      if (res.status === 429) {
        setStatus("cooldown");
        setTimeout(() => search(query, yr, pg, append), 2500);
        return;
      }
      if (!res.ok) throw new Error("unavailable");
      const { results: raw } = await res.json();
      fetchArtistFix(query); // spelling check in parallel

      if (!raw?.length) {
        if (!append) setResults([]);
        setStatus(append ? "live" : "none");
        return;
      }

      // popularity map so the "real" Drake beats Drake Milligan
      let popMap: Record<string, number> = {};
      try {
        const pr = await fetch(`/api/artists?name=${encodeURIComponent(query)}`);
        for (const a of (await pr.json()).artists ?? []) popMap[a.name.toLowerCase()] = a.popularity ?? 0;
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
          dateDisplay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          year: d.getFullYear(),
          setlist: r.setlist.map((s: any) => s.name),
          c1, c2,
          initials: r.artist[0]?.toUpperCase() ?? "?",
          imageUrl: imgs[`${r.artist}::${r.tour ?? ""}`],
          lat: r.lat, lng: r.lng,
        };
      });
      mapped.sort((a, b) => {
        const qa = a.artist.toLowerCase() === query.toLowerCase() ? 1 : 0;
        const qb = b.artist.toLowerCase() === query.toLowerCase() ? 1 : 0;
        if (qa !== qb) return qb - qa; // exact name match first
        const pa = popMap[a.artist.toLowerCase()] ?? -1;
        const pb = popMap[b.artist.toLowerCase()] ?? -1;
        if (pa !== pb) return pb - pa; // then by popularity
        return +new Date(b.dateDisplay) - +new Date(a.dateDisplay); // then newest
      });
      setTypeahead([]);
      setResults(append ? (prev) => [...prev, ...mapped] as any : mapped);
      setPage(pg);
      setStatus("live");
    } catch {
      const mock = MOCK_SEARCH.filter((r) => r.artist.toLowerCase().includes(query.toLowerCase()));
      setResults(mock as Result[]);
      setStatus(mock.length ? "mock" : "none");
    }
  }

  const pick = (r: Result) => {
    const c: ConcertRec = { ...r, id: `${r.id}-${Date.now()}`, rating: 5, price: 0, photos: 0, notes: "" };
    addConcert(c);
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
            placeholder="Artist, tour, or festival"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-sub"
            autoFocus
          />
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="shrink-0 rounded-lg bg-card2 px-2 py-1 text-sm text-accent outline-none"
            aria-label="Filter by year"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {typeahead.length > 0 && results.length === 0 && (
          <div className="overflow-hidden rounded-2xl bg-card">
            {typeahead.map((a, i) => (
              <button
                key={a.name}
                onClick={() => {
                  setTypeahead([]);
                  setQ(a.name);
                  if (timer.current) clearTimeout(timer.current);
                  setStatus("loading");
                  search(a.name, year, 1, false);
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

        {status === "loading" && <p className="text-center text-xs text-sub">Searching…</p>}
        {status === "cooldown" && <p className="text-center text-xs text-sub">Busy — retrying…</p>}
        {status === "none" && (
          <p className="text-center text-xs text-sub">
            No shows found{year !== "All" ? ` in ${year}` : ""}. Check the spelling or try another year.
          </p>
        )}
        {status === "mock" && (
          <p className="text-center text-[10px] text-sub">DEMO MODE — add API keys to .env.local for live sync</p>
        )}

        {(() => {
          const tours = [...new Set(results.map((r) => r.tour))];
          return tours.length > 1 ? (
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="self-start rounded-lg bg-card px-3 py-2 text-sm text-accent outline-none"
              aria-label="Filter by tour"
            >
              <option value="All">All tours ({results.length})</option>
              {tours.map((t) => (
                <option key={t} value={t}>{t} ({results.filter((r) => r.tour === t).length})</option>
              ))}
            </select>
          ) : null;
        })()}
        <div className="flex flex-col gap-2">
          {results.filter((r) => tourFilter === "All" || r.tour === tourFilter).map((r, ri) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className="pressable fade-up flex items-center gap-3 rounded-2xl bg-card p-3 text-left"
              style={{ animationDelay: `${Math.min(ri, 10) * 45}ms` }}
            >
              <div className="w-12 shrink-0">
                <Art c1={r.c1} c2={r.c2} initials={r.initials} imageUrl={r.imageUrl} className="rounded-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-semibold">{r.artist}</div>
                <div className="truncate text-xs text-sub">{r.tour}</div>
                <div className="text-xs text-sub">{r.venue} · {r.city}</div>
                <div className="text-xs text-sub">{r.dateDisplay} · {r.setlist.length ? `${r.setlist.length} songs` : "no setlist yet"}</div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-accent">Add</span>
            </button>
          ))}
        </div>

        {status === "live" && results.length >= 20 * page && (
          <button
            onClick={() => { setStatus("loading"); search(q, year, page + 1, true); }}
            className="pressable mx-auto rounded-full bg-card px-5 py-2.5 text-sm text-accent"
          >
            Load more shows
          </button>
        )}

        {status === "idle" && (
          <p className="pt-12 text-center text-sm text-sub">
            Search any artist you&apos;ve seen live.<br />Pick the show, we&apos;ll pull the setlist.
          </p>
        )}
        <p className="mt-auto pt-4 text-center text-[10px] text-sub">Concert data from setlist.fm · Artist images from Spotify</p>
      </section>
    </AppShell>
  );
}
