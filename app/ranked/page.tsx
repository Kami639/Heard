"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Art } from "@/components/Art";
import { useConcerts } from "@/lib/useConcerts";
import { getRanking, removeFromRanking } from "@/lib/ranking";

export default function Ranked() {
  const router = useRouter();
  const concerts = useConcerts();
  const order = getRanking();
  const byId = new Map(concerts.map((c) => [c.id, c]));
  const items = order.map((id) => byId.get(id)).filter(Boolean);

  return (
    <AppShell title="ranked" count={items.length}>
      <section className="flex flex-1 flex-col gap-2 px-5 pb-8 pt-2">
        <p className="pb-1 text-xs text-sub">
          Built from head-to-head picks, not star ratings — the only honest way to rank years of shows.
        </p>
        {items.length === 0 && (
          <p className="pt-8 text-center text-sm text-sub">
            Open any concert and tap &ldquo;Rank this show&rdquo; to start.
          </p>
        )}
        {items.map((c, i) => (
          <div key={c!.id} className="flex items-center gap-3">
            <span className={`w-7 shrink-0 text-right font-display text-lg font-extrabold ${i < 3 ? "text-accent" : "text-sub"}`}>
              {i + 1}
            </span>
            <button
              onClick={() => router.push(`/concert/${c!.id}`)}
              className="pressable flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-card p-2.5 text-left"
            >
              <span className="w-10 shrink-0">
                <Art c1={c!.c1} c2={c!.c2} initials={c!.initials} imageUrl={c!.imageUrl} artists={c!.artists} className="rounded-lg" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c!.artist}</span>
                <span className="block truncate text-[11px] text-sub">{c!.venue} · {c!.city} · {c!.dateDisplay}</span>
              </span>
            </button>
            <button
              onClick={() => removeFromRanking(c!.id)}
              aria-label="Remove from ranking"
              className="pressable shrink-0 text-xs text-sub"
            >
              ✕
            </button>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
