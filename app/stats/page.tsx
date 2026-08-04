"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Heatmap } from "@/components/viz/Heatmap";
import { ArtistNetwork } from "@/components/viz/ArtistNetwork";
import { useConcerts } from "@/lib/useConcerts";
import { uniqueShowCount } from "@/features/concerts/data";
import { downloadPassportCard } from "@/lib/shareCard";

/* The bento wall: every number the archive knows, at a glance. */

function Tile({ children, wide = false, label }: {
  children: React.ReactNode; wide?: boolean; label?: string;
}) {
  return (
    <div className={`reveal flex flex-col gap-1.5 rounded-2xl bg-card p-4 ${wide ? "col-span-2" : ""}`}>
      {label && <p className="text-[11px] font-semibold tracking-wide text-accent">{label}</p>}
      {children}
    </div>
  );
}

function Big({ v, sub }: { v: string | number; sub: string }) {
  return (
    <>
      <span className="font-display text-3xl font-extrabold leading-none">{v}</span>
      <span className="text-xs text-sub">{sub}</span>
    </>
  );
}

export default function Stats() {
  const concerts = useConcerts();
  const attended = useMemo(() => concerts.filter((c) => !c.cancelled), [concerts]);

  const s = useMemo(() => {
    const dates = attended
      .map((c) => new Date(c.dateDisplay)).filter((d) => !isNaN(+d) && +d <= Date.now())
      .sort((a, b) => +a - +b);

    const monthCount = new Map<string, number>();
    for (const d of dates) {
      const k = d.toLocaleString("en", { month: "long", year: "numeric" });
      monthCount.set(k, (monthCount.get(k) ?? 0) + 1);
    }
    const busiest = [...monthCount.entries()].sort((a, b) => b[1] - a[1])[0];

    let longestGap = 0;
    for (let i = 1; i < dates.length; i++)
      longestGap = Math.max(longestGap, Math.round((+dates[i] - +dates[i - 1]) / 86400000));

    const venueCount = new Map<string, number>();
    for (const c of attended) venueCount.set(c.venue, (venueCount.get(c.venue) ?? 0) + 1);
    const topVenue = [...venueCount.entries()].sort((a, b) => b[1] - a[1])[0];

    const rated = attended.filter((c) => c.rating > 0);
    const avg = rated.length ? (rated.reduce((n, c) => n + c.rating, 0) / rated.length) : 0;
    const spent = attended.reduce((n, c) => n + (c.price || 0), 0);
    const songs = attended.reduce((n, c) => n + c.setlist.length, 0);
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowCount = new Map<number, number>();
    for (const d of dates) dowCount.set(d.getDay(), (dowCount.get(d.getDay()) ?? 0) + 1);
    const topDow = [...dowCount.entries()].sort((a, b) => b[1] - a[1])[0];

    // passport data
    const cityMap = new Map<string, { country?: string; shows: number; firstYear: number }>();
    for (const c of attended) {
      if (!c.city) continue;
      const cur = cityMap.get(c.city);
      cityMap.set(c.city, {
        country: c.country ?? cur?.country,
        shows: (cur?.shows ?? 0) + 1,
        firstYear: Math.min(cur?.firstYear ?? 9999, c.year),
      });
    }
    const stamps = [...cityMap.entries()]
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.shows - a.shows);

    const crewCount = new Map<string, number>();
    for (const c of attended) for (const name of c.crew ?? [])
      crewCount.set(name, (crewCount.get(name) ?? 0) + 1);
    const topCrew = [...crewCount.entries()].sort((a, b) => b[1] - a[1])[0];

    return { busiest, longestGap, topVenue, avg, spent, songs, topDow: topDow ? dows[topDow[0]] : null, stamps, topCrew };
  }, [attended]);

  return (
    <AppShell title="stats" count={concerts.length}>
      <section className="grid flex-1 grid-cols-2 content-start gap-3 px-5 pb-6 pt-2">
        <Tile wide label="EVERY NIGHT OUT">
          <Heatmap concerts={concerts} />
        </Tile>

        <Tile label="SHOWS"><Big v={uniqueShowCount(attended)} sub="in the archive" /></Tile>
        <Tile label="SONGS"><Big v={s.songs} sub="heard live" /></Tile>

        <Tile wide label="THE WEB">
          <p className="text-xs text-sub">Artists who shared a stage at your shows</p>
          <ArtistNetwork concerts={concerts} />
        </Tile>

        {s.busiest && <Tile label="BUSIEST MONTH"><Big v={s.busiest[1]} sub={s.busiest[0]} /></Tile>}
        {s.topVenue && (
          <Tile label="HOME VENUE">
            <span className="font-display text-lg font-extrabold leading-tight">{s.topVenue[0]}</span>
            <span className="text-xs text-sub">{s.topVenue[1]} nights</span>
          </Tile>
        )}
        {s.avg > 0 && <Tile label="AVG RATING"><Big v={s.avg.toFixed(1)} sub="out of 5 stars" /></Tile>}
        {s.spent > 0 && <Tile label="INVESTED"><Big v={`$${Math.round(s.spent).toLocaleString()}`} sub="in live music" /></Tile>}
        {s.longestGap > 0 && <Tile label="LONGEST DROUGHT"><Big v={`${s.longestGap}d`} sub="between shows" /></Tile>}
        {s.topDow && <Tile label="YOUR NIGHT"><Big v={s.topDow} sub="most common show day" /></Tile>}
        {s.topCrew && <Tile label="RIDE OR DIE"><Big v={s.topCrew[0]} sub={`${s.topCrew[1]} shows together`} /></Tile>}

        {s.stamps.length > 0 && (
          <Tile wide label="CONCERT PASSPORT">
            <p className="text-xs text-sub">
              {s.stamps.length} {s.stamps.length === 1 ? "city" : "cities"} stamped —
              export it as a shareable passport page.
            </p>
            <button
              onClick={() => downloadPassportCard(s.stamps)}
              className="pressable mt-1 self-start rounded-full border border-hairline bg-card2 px-5 py-2 font-mono text-xs tracking-[0.15em]"
            >
              ⤓ STAMP MY PASSPORT
            </button>
          </Tile>
        )}
      </section>
    </AppShell>
  );
}
