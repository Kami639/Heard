"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useConcerts } from "@/lib/useConcerts";
import { computeHeardies, type Category } from "@/features/heardies";
import { downloadHeardiesCard } from "@/lib/shareCard";

/* ═══ THE HEARDIES ═══
 * An award show where every envelope is your own life. Ceremony mode walks
 * category by category: nominees first, a beat of suspense, then the winner.
 * Skip straight to the recap grid anytime. */

type Phase = "nominees" | "envelope" | "winner";

export default function Heardies() {
  const router = useRouter();
  const concerts = useConcerts();

  const years = useMemo(() => {
    const ys = [...new Set(concerts.filter((c) => !c.cancelled).map((c) => c.year))]
      .filter((y) => y > 1950).sort((a, b) => b - a);
    return ys;
  }, [concerts]);

  const [year, setYear] = useState<number | "all">(years[0] ?? "all");
  const cats = useMemo(() => computeHeardies(concerts, year), [concerts, year]);

  const [idx, setIdx] = useState(-1); // -1 closed; 0..n ceremony; n done
  const [phase, setPhase] = useState<Phase>("nominees");
  const ceremonyOpen = idx >= 0 && idx < cats.length;

  function advance() {
    if (phase === "nominees") { setPhase("envelope"); setTimeout(() => setPhase("winner"), 1400); return; }
    if (phase === "envelope") return; // let the suspense land
    if (idx + 1 >= cats.length) { setIdx(-1); return; }
    setIdx(idx + 1); setPhase("nominees");
  }

  const yearLabel = year === "all" ? "ALL TIME" : String(year);

  return (
    <AppShell title="the heardies" count={concerts.length}>
      {/* ── ceremony takeover ─────────────────────────────────────────── */}
      {ceremonyOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={advance}
          role="dialog" aria-label="Heardies ceremony"
        >
          <div className="flex gap-1 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]" aria-hidden>
            {cats.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-accent" : "bg-card2"}`} />
            ))}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-sub">THE {yearLabel} HEARDIES</span>
            <span className="text-5xl" aria-hidden>{cats[idx].icon}</span>
            <h2 className="font-display text-2xl font-extrabold text-accent">{cats[idx].label}</h2>

            {phase === "nominees" && (
              <div className="flex w-full max-w-sm flex-col gap-2 pt-2">
                <p className="font-mono text-[11px] tracking-[0.2em] text-sub">THE NOMINEES ARE</p>
                {[cats[idx].winner, ...cats[idx].nominees]
                  .map((n, i) => (
                    <div
                      key={i}
                      className="fade-up rounded-xl bg-card px-4 py-3"
                      style={{ animationDelay: `${i * 220}ms` }}
                    >
                      <p className="truncate text-[15px] font-semibold">{n.title}</p>
                      <p className="truncate text-xs text-sub">{n.sub}</p>
                    </div>
                  ))}
                <p className="pt-3 font-mono text-[10px] text-sub">tap to open the envelope</p>
              </div>
            )}

            {phase === "envelope" && (
              <p className="fade-up pt-4 font-display text-xl">
                And the Heardie goes to<span className="animate-pulse">…</span>
              </p>
            )}

            {phase === "winner" && (
              <div className="fade-up flex flex-col items-center gap-2 pt-2">
                <span className="text-6xl" aria-hidden>🏆</span>
                <p className="name-xl max-w-full break-words px-2 font-display text-4xl font-extrabold">
                  {cats[idx].winner.title}
                </p>
                <p className="text-sm text-sub">{cats[idx].winner.sub}</p>
                <p className="pt-5 font-mono text-[10px] text-sub">
                  {idx + 1 < cats.length ? "tap for the next category" : "tap to finish"}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(-1); }}
            className="pressable pb-[calc(1rem+env(safe-area-inset-bottom))] text-center font-mono text-[11px] text-sub"
          >
            skip to results
          </button>
        </div>
      )}

      {/* ── page ──────────────────────────────────────────────────────── */}
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[...years, "all" as const].map((y) => (
            <button
              key={y}
              onClick={() => { setYear(y as any); setIdx(-1); }}
              className={`pressable shrink-0 rounded-full px-3 py-1 font-mono text-[11px] ${
                y === year ? "bg-accent font-semibold text-black" : "bg-card text-sub"
              }`}
            >
              {y === "all" ? "ALL TIME" : y}
            </button>
          ))}
        </div>

        {cats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center">
            <span className="text-4xl" aria-hidden>🏆</span>
            <p className="font-semibold">Not enough contenders {year === "all" ? "yet" : `in ${year}`}</p>
            <p className="text-xs text-sub">
              Awards need competition — a couple more shows (with ratings, prices, setlists)
              and the nominations write themselves.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={() => { setIdx(0); setPhase("nominees"); }}
              className="pressable flex items-center justify-center gap-3 rounded-2xl bg-accent py-4 font-display text-lg font-extrabold text-black"
            >
              🏆 Roll out the carpet — {cats.length} categories
            </button>

            <div className="grid grid-cols-1 gap-3">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => c.winner.concertId && router.push(`/concert/${c.winner.concertId}`)}
                  className="reveal flex items-center gap-3 rounded-2xl bg-card p-4 text-left"
                >
                  <span className="text-3xl" aria-hidden>{c.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold tracking-wide text-accent">{c.label.toUpperCase()}</p>
                    <p className="truncate font-display text-[17px] font-extrabold">{c.winner.title}</p>
                    <p className="truncate text-xs text-sub">{c.winner.sub}</p>
                    {c.nominees.length > 0 && (
                      <p className="truncate pt-0.5 text-[10px] text-sub">
                        over {c.nominees.map((n) => n.title).join(", ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => downloadHeardiesCard(yearLabel, cats.map((c) => ({
                icon: c.icon, label: c.label, winner: c.winner.title,
              })))}
              className="pressable mx-auto rounded-full border border-hairline bg-card px-6 py-2.5 font-mono text-xs tracking-[0.15em]"
            >
              ⤓ SHARE THE BALLOT
            </button>
          </>
        )}
      </section>
    </AppShell>
  );
}
