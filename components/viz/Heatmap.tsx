"use client";

import { useMemo, useState } from "react";
import type { ConcertRec } from "@/features/concerts/data";

/* The GitHub graph, for gigs. One cell per week-day of a year; a lit cell
 * is a night you were in the room. Scrollable across years. */

export function Heatmap({ concerts }: { concerts: ConcertRec[] }) {
  const attended = concerts.filter((c) => !c.cancelled);

  const byDay = useMemo(() => {
    const m = new Map<string, ConcertRec[]>();
    for (const c of attended) {
      const d = new Date(c.dateDisplay);
      if (isNaN(+d) || +d > Date.now()) continue;
      const k = d.toISOString().slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [concerts]);

  const years = useMemo(() => {
    const ys = [...new Set(attended.map((c) => c.year).filter((y) => y > 1950))].sort((a, b) => b - a);
    return ys.length ? ys : [new Date().getFullYear()];
  }, [concerts]);

  const [year, setYear] = useState(years[0]);
  const [picked, setPicked] = useState<{ date: string; shows: ConcertRec[] } | null>(null);

  // build the grid: columns = weeks, rows = Sun..Sat
  const start = new Date(year, 0, 1);
  const startDow = start.getDay();
  const gridStart = new Date(+start - startDow * 86400000);
  const weeks: { date: Date; key: string }[][] = [];
  for (let w = 0; w < 53; w++) {
    const col: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(+gridStart + (w * 7 + d) * 86400000);
      col.push({ date, key: date.toISOString().slice(0, 10) });
    }
    weeks.push(col);
  }
  const yearShows = attended.filter((c) => c.year === year).length;
  const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { setYear(y); setPicked(null); }}
              className={`pressable shrink-0 rounded-full px-3 py-1 font-mono text-[11px] ${
                y === year ? "bg-accent font-semibold text-black" : "bg-card2 text-sub"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <span className="shrink-0 pl-2 font-mono text-[11px] text-sub">{yearShows} shows</span>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <svg
          width={53 * 13 + 8}
          height={7 * 13 + 18}
          role="img"
          aria-label={`Concert calendar for ${year}: ${yearShows} shows`}
        >
          {weeks.map((col, w) => {
            const first = col[0].date;
            const label = first.getDate() <= 7 && first.getFullYear() === year
              ? MONTH_LABELS[first.getMonth()] : null;
            return (
              <g key={w}>
                {label && (
                  <text x={w * 13} y={10} fill="#8e8e93" fontSize={9} fontFamily="ui-monospace, monospace">
                    {label}
                  </text>
                )}
                {col.map(({ date, key }, d) => {
                  if (date.getFullYear() !== year) return null;
                  const shows = byDay.get(key) ?? [];
                  const n = shows.length;
                  const fill = n === 0 ? "#1c1c1e" : n === 1 ? "#8a5a10" : "#ff9f0a";
                  return (
                    <rect
                      key={key}
                      x={w * 13} y={16 + d * 13}
                      width={10} height={10} rx={2.5}
                      fill={fill}
                      style={n ? { cursor: "pointer", filter: "drop-shadow(0 0 3px rgba(255,159,10,0.5))" } : undefined}
                      onClick={() => n && setPicked({ date: key, shows })}
                    >
                      <title>{`${key}${n ? ` — ${shows.map((s) => s.artist).join(", ")}` : ""}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {picked && (
        <div className="fade-up rounded-xl bg-card2 px-3 py-2">
          {picked.shows.map((s) => (
            <a key={s.id} href={`/concert/${s.id}`} className="block py-0.5 text-[13px]">
              <span className="font-semibold">{s.artist}</span>
              <span className="text-sub"> · {s.venue} · {picked.date}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
