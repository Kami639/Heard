"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts } from "@/lib/store";
import type { ConcertRec } from "@/features/concerts/data";

export default function Profile() {
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  useEffect(() => setConcerts(getConcerts()), []);

  const rows: [string, string][] = [
    ["Appearance", "Dark"],
    ["Storage", `${concerts.length} / 1000 memories`],
    ["Data", "setlist.fm · Spotify"],
    ["Version", "1.0"],
  ];

  return (
    <AppShell title="profile" count={concerts.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <LcdStat label="Shows" value={concerts.length} />
          <LcdStat label="Cities" value={new Set(concerts.map((c) => c.city)).size} />
          <LcdStat label="Spent" value={`$${concerts.reduce((s, c) => s + c.price, 0)}`} />
          <LcdStat label="Songs heard" value={concerts.reduce((s, c) => s + c.setlist.length, 0)} />
        </div>
        <div className="overflow-hidden rounded-2xl bg-card">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex justify-between px-4 py-3.5 text-[15px] ${i < rows.length - 1 ? "border-b border-hairline" : ""}`}>
              <span>{k}</span>
              <span className="text-sub">{v}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
