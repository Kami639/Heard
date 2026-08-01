"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts } from "@/lib/store";
import { downloadWrappedCard } from "@/lib/shareCard";
import type { ConcertRec } from "@/features/concerts/data";

export default function Wrapped() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [story, setStory] = useState(-1); // -1 = closed, 0..n = slide index

  useEffect(() => {
    setConcerts(getConcerts());
    const t = setTimeout(() => setReady(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const yearsAvail = [...new Set(concerts.map((c) => c.year))].sort((a, b) => b - a);
  const YEAR = year ?? yearsAvail[0] ?? new Date().getFullYear();
  const yr = concerts.filter((c) => c.year === YEAR);
  const songsCount = yr.reduce((s, c) => s + c.setlist.length, 0);
  const hours = Math.round((songsCount * 3.5) / 60 * 10) / 10;
  const artistCounts = new Map<string, { count: number; imageUrl?: string | null }>();
  for (const c of yr) {
    const cur = artistCounts.get(c.artist);
    artistCounts.set(c.artist, { count: (cur?.count ?? 0) + 1, imageUrl: cur?.imageUrl ?? c.imageUrl });
  }
  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, v]) => ({ name, count: v.count, imageUrl: v.imageUrl }));

  const slides: { label: string; value: string; sub?: string }[] = [
    { label: "", value: `${YEAR}`, sub: "your year in live music" },
    { label: "SHOWS", value: `${yr.length}`, sub: yr.length === 1 ? "one unforgettable night" : "nights you'll never forget" },
    { label: "CITIES", value: `${new Set(yr.map((c) => c.city)).size}`, sub: "everywhere the music took you" },
    { label: "HOURS OF LIVE MUSIC", value: `≈${hours}`, sub: `${songsCount} songs, live` },
    ...(topArtists.length ? [{ label: "TOP ARTIST", value: topArtists[0].name, sub: `${topArtists[0].count} ${topArtists[0].count === 1 ? "show" : "shows"} this year` }] : []),
  ];

  useEffect(() => {
    if (story < 0) return;
    if (story >= slides.length) { setStory(-1); return; }
    const t = setTimeout(() => setStory((s) => s + 1), 2800);
    return () => clearTimeout(t);
  }, [story, slides.length]);

  return (
    <AppShell title="wrapped" count={concerts.length}>
      {story >= 0 && story < slides.length && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black"
          onClick={(e) => {
            const x = (e as any).clientX ?? 0;
            if (x < window.innerWidth / 3) setStory((s) => Math.max(0, s - 1));
            else setStory((s) => s + 1);
          }}
        >
          <div className="flex gap-1.5 p-3 pt-5">
            {slides.map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-card2">
                <div
                  className="h-full bg-accent"
                  style={{
                    width: i < story ? "100%" : i === story ? undefined : "0%",
                    animation: i === story ? "storyBar 2.8s linear forwards" : undefined,
                  }}
                />
              </div>
            ))}
          </div>
          <div key={story} className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            {slides[story].label && (
              <span className="fade-up text-sm font-semibold tracking-[0.2em] text-sub">{slides[story].label}</span>
            )}
            <span
              className="fade-up break-words font-display font-extrabold leading-none text-accent"
              style={{ fontSize: slides[story].value.length > 6 ? "13vw" : "26vw", maxWidth: "100%", animationDelay: "120ms" }}
            >
              {slides[story].value}
            </span>
            {slides[story].sub && (
              <span className="fade-up text-lg text-ink" style={{ animationDelay: "300ms" }}>{slides[story].sub}</span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setStory(-1); }}
            className="absolute right-4 top-8 text-2xl text-sub"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      <section className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <select
            value={YEAR}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg bg-card px-3 py-1.5 font-display text-lg font-bold text-accent outline-none"
            aria-label="Wrapped year"
          >
            {(yearsAvail.length ? yearsAvail : [YEAR]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="font-display text-lg font-bold">Wrapped</span>
          {yr.length > 0 && (
            <button
              onClick={() => setStory(0)}
              className="pressable ml-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-black"
            >
              ▶ Play
            </button>
          )}
        </div>
        <div
          className="relative h-36 w-36 rounded-full border border-hairline shadow-[0_4px_12px_rgb(30_30_30/0.25)]"
          style={{
            background: "conic-gradient(from 0deg, #d8d2c4, #f2eee4, #cfc8b8, #f2eee4, #d8d2c4)",
            animation: `spin ${ready ? 6 : 1.6}s linear infinite`,
          }}
          aria-hidden
        >
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline bg-paper" />
        </div>
        {!ready ? (
          <p className="font-mono text-xs text-sub">Reading disc...</p>
        ) : (
          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <LcdStat label="Shows" value={yr.length} />
            <LcdStat label="Cities" value={new Set(yr.map((c) => c.city)).size} />
            <LcdStat label="Spent" value={`$${yr.reduce((s, c) => s + c.price, 0)}`} />
            <LcdStat label="Hours of live music" value={`≈${hours}`} />
            <LcdStat label="Songs Heard" value={yr.reduce((s, c) => s + c.setlist.length, 0)} />
            {topArtists.length > 0 && (
              <div className="col-span-2 overflow-hidden rounded-2xl bg-card">
                <p className="px-4 pb-1 pt-3 text-xs font-medium text-sub">TOP ARTISTS</p>
                {topArtists.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 font-display text-lg font-bold text-accent">{i + 1}</span>
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 text-xs text-sub">{a.name[0]}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px]">{a.name}</span>
                    <span className="text-xs text-sub">{a.count} {a.count === 1 ? "show" : "shows"}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => downloadWrappedCard({
                year: YEAR,
                shows: yr.length,
                cities: new Set(yr.map((c) => c.city)).size,
                spent: yr.reduce((s, c) => s + c.price, 0),
                songs: songsCount,
                hours,
                topArtists,
              })}
              className="pressable col-span-2 rounded-full border border-hairline bg-card px-6 py-2.5 font-mono text-xs tracking-[0.15em]"
            >
              ⤓ SHARE CARD
            </button>
          </div>
        )}
      </section>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
