"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useConcerts } from "@/lib/useConcerts";
import { getConcerts } from "@/lib/store";
import { ACHIEVEMENTS, tally, describe } from "@/features/achievements";
import { splitArtists } from "@/features/concerts/data";
import type { ConcertRec } from "@/features/concerts/data";

export default function Achievements() {
  const concerts = useConcerts();

  // learn artist birthdays a few at a time (MusicBrainz allows 1 req/sec)
  useEffect(() => {
    let alive = true;
    (async () => {
      let facts: Record<string, { born: string | null }> = {};
      try { facts = JSON.parse(localStorage.getItem("heard.artistfacts.v1") ?? "{}"); } catch {}
      const names = [...new Set(concerts.flatMap((c) => splitArtists(c.artist)))]
        .filter((n) => !(n.toLowerCase() in facts))
        .slice(0, 5);
      if (!names.length) return;

      for (const name of names) {
        try {
          const r = await fetch(`/api/artist-facts?name=${encodeURIComponent(name)}`);
          const d = await r.json();
          facts[name.toLowerCase()] = { born: d.born ?? null };
        } catch { facts[name.toLowerCase()] = { born: null }; }
      }
      if (!alive) return;
      try { localStorage.setItem("heard.artistfacts.v1", JSON.stringify(facts)); } catch {}
      window.dispatchEvent(new Event("heard-sync"));
    })();
    return () => { alive = false; };
  }, [concerts.length]);

  const { unlocked, points } = tally(concerts);
  const unlockedIds = new Set(unlocked.map((a) => a.id));

  return (
    <AppShell title="achievements" count={concerts.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-card py-5">
          <span className="text-3xl text-accent">★</span>
          <span className="font-display text-4xl font-extrabold text-accent">{points}</span>
          <span className="pl-1 text-sm text-sub">pts · {unlocked.length}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full bg-accent transition-all duration-1000 ease-out"
            style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const got = unlockedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={`fade-up flex flex-col gap-1 rounded-2xl p-4 ${got ? "bg-card" : "bg-card/40 opacity-50"}`}
              >
                <span className="text-2xl">{got ? a.icon : "🔒"}</span>
                <span className={`text-[15px] font-semibold ${got ? "text-ink" : "text-sub"}`}>{a.name}</span>
                <span className="text-xs text-sub">{a.desc}</span>
                {(() => {
                  const line = describe(a, concerts, got);
                  return line ? (
                    <span className={`truncate text-[10px] ${got ? "text-ink/70" : "text-sub"}`} title={line}>
                      {got ? line : `${line} so far`}
                    </span>
                  ) : null;
                })()}
                <span className={`pt-1 text-xs font-semibold ${got ? "text-accent" : "text-sub"}`}>★ {a.pts}</span>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
