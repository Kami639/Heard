"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { useConcerts } from "@/lib/useConcerts";
import { getConcerts } from "@/lib/store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

export default function Archive() {
  const router = useRouter();
  const concerts = useConcerts();

  const byYear = new Map<number, ConcertRec[]>();
  for (const c of concerts) {
    byYear.set(c.year, [...(byYear.get(c.year) ?? []), c]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <AppShell title="archive" count={concerts.length}>
      <section className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        {concerts.length === 0 && (
          <p className="pt-16 text-center text-sm text-sub">Nothing here yet — add your first concert.</p>
        )}
        {years.map((y) => (
          <div key={y}>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">{y}</h2>
            <div className="overflow-hidden rounded-2xl bg-card">
              {byYear.get(y)!.map((c, i, arr) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/concert/${c.id}`)}
                  className={`pressable flex w-full items-center gap-3 px-4 py-3 text-left ${i < arr.length - 1 ? "border-b border-hairline" : ""}`}
                >
                  <div className="w-12 shrink-0"><Art c1={c.c1} c2={c.c2} initials={c.initials} imageUrl={c.imageUrl} artists={c.artists} className="rounded-xl" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[15px] font-semibold">{c.artist}</div>
                    <div
                  onClick={(e) => { e.stopPropagation(); if (c.tour) router.push(`/tour/${encodeURIComponent(c.tour)}?artist=${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`); }}
                  className="truncate text-xs text-sub hover:text-accent"
                >
                  {c.tour}
                </div>
                    <div className="text-xs text-sub">{c.city} · {c.dateDisplay}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Stars n={c.rating} />
                    <ChevronRight size={16} className="text-sub" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
