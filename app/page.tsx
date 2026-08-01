"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Music2, Disc3 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts, daysUntil } from "@/lib/store";
import type { ConcertRec } from "@/features/concerts/data";

export default function Home() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  useEffect(() => setConcerts(getConcerts()), []);

  const latest = concerts[0];
  const cities = new Set(concerts.map((c) => c.city)).size;
  const songs = concerts.reduce((s, c) => s + c.setlist.length, 0);

  return (
    <AppShell count={concerts.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        {latest ? (
          <button
            onClick={() => router.push(`/concert/${latest.id}`)}
            className="pressable overflow-hidden rounded-2xl bg-card text-left"
          >
            <Art c1={latest.c1} c2={latest.c2} initials={latest.initials} imageUrl={latest.imageUrl} className="rounded-none border-0" />
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-display text-xl font-bold">{latest.artist}</div>
                <div className="text-sm text-sub">{latest.tour}</div>
                <div className="mt-0.5 text-xs text-sub">{latest.city} · {latest.dateDisplay}</div>
                {daysUntil(latest.dateDisplay) !== null && (
                  <span className="mt-1 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                    in {daysUntil(latest.dateDisplay)} days
                  </span>
                )}
              </div>
              <Stars n={latest.rating} />
            </div>
          </button>
        ) : (
          <button
            onClick={() => router.push("/add")}
            className="pressable flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-12 text-center"
          >
            <Disc3 className="text-accent" size={36} />
            <span className="font-display text-lg font-bold">No memories yet</span>
            <span className="text-sm text-sub">Add your first concert</span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Shows" value={concerts.length} />
          <LcdStat label="Cities" value={cities} />
          <LcdStat label="Songs" value={songs} />
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {[
            { label: "Songs Heard", href: "/songs", icon: Music2 },
            { label: "Wrapped", href: "/wrapped", icon: Disc3 },
          ].map(({ label, href, icon: Icon }, i, arr) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`pressable flex w-full items-center gap-3 px-4 py-3.5 text-left ${i < arr.length - 1 ? "border-b border-hairline" : ""}`}
            >
              <Icon size={20} className="text-accent" />
              <span className="flex-1 text-[15px]">{label}</span>
              <ChevronRight size={18} className="text-sub" />
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
