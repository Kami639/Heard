"use client";

import { useEffect, useMemo, useState } from "react";
import { Share } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useConcerts } from "@/lib/useConcerts";
import { ACHIEVEMENTS, tally, describe } from "@/features/achievements";
import { splitArtists } from "@/features/concerts/data";
import { useRarity, TIER_STYLE } from "@/lib/rarity";
import { downloadBadgeCard } from "@/lib/shareCard";

export default function Achievements() {
  const concerts = useConcerts();
  const [sort, setSort] = useState<"default" | "rarest">("default");

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
  const rarity = useRarity([...unlockedIds]);

  const ordered = useMemo(() => {
    if (sort === "default") return ACHIEVEMENTS;
    return [...ACHIEVEMENTS].sort((a, b) => {
      const ra = rarity.lookup(a).pct ?? 200 - a.pts; // no data: rarer if worth more
      const rb = rarity.lookup(b).pct ?? 200 - b.pts;
      return ra - rb;
    });
  }, [sort, rarity]);

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

        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-sub">
            {rarity.total >= 3
              ? `Rarity across ${rarity.total} concert heads`
              : "Rarity tiers are estimates until more people sync"}
          </p>
          <div className="flex gap-1">
            {(["default", "rarest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`pressable rounded-full px-3 py-1 font-mono text-[10px] ${
                  sort === s ? "bg-accent font-semibold text-black" : "bg-card text-sub"
                }`}
              >
                {s === "default" ? "ALL" : "RAREST"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ordered.map((a) => {
            const got = unlockedIds.has(a.id);
            const { pct, tier } = rarity.lookup(a);
            const style = TIER_STYLE[tier];
            return (
              <div
                key={a.id}
                className={`fade-up relative flex flex-col gap-1 rounded-2xl p-4 ${got ? "bg-card" : "bg-card/40 opacity-50"}`}
              >
                {got && (
                  <button
                    onClick={() =>
                      downloadBadgeCard({
                        icon: a.icon, name: a.name, desc: a.desc, pts: a.pts,
                        pct, tierLabel: style.label,
                        evidence: describe(a, concerts, true),
                      })
                    }
                    aria-label={`Share ${a.name} badge`}
                    className="pressable absolute right-3 top-3 rounded-full bg-card2 p-1.5 text-sub"
                  >
                    <Share size={13} />
                  </button>
                )}
                <span className="text-2xl">{got ? a.icon : "🔒"}</span>
                <span className={`pr-6 text-[15px] font-semibold ${got ? "text-ink" : "text-sub"}`}>{a.name}</span>
                <span className="text-xs text-sub">{a.desc}</span>
                {(() => {
                  const line = describe(a, concerts, got);
                  return line ? (
                    <span className={`truncate text-[10px] ${got ? "text-ink/70" : "text-sub"}`} title={line}>
                      {got ? line : `${line} so far`}
                    </span>
                  ) : null;
                })()}
                <div className="flex items-center gap-2 pt-1">
                  <span className={`text-xs font-semibold ${got ? "text-accent" : "text-sub"}`}>★ {a.pts}</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide ${style.cls}`}>
                    {pct != null ? `${pct}% HAVE THIS` : style.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
