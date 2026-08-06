"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useConcerts } from "@/lib/useConcerts";

/* Every show with one person. The crew chip on a concert page promises
 * this exact view — tap a name, get the shared history. */

export default function CrewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = use(params);
  const name = decodeURIComponent(raw);
  const router = useRouter();
  const concerts = useConcerts();

  const together = useMemo(
    () =>
      concerts
        .filter((c) => !c.cancelled && (c.crew ?? []).some((x) => x.toLowerCase() === name.toLowerCase()))
        .sort((a, b) => +new Date(b.dateDisplay) - +new Date(a.dateDisplay)),
    [concerts, name]
  );

  const spent = together.reduce((n, c) => n + (c.price || 0), 0);
  const years = new Set(together.map((c) => c.year));

  return (
    <AppShell title={name.toLowerCase()} count={together.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="flex items-center gap-4 rounded-2xl bg-card p-4">
          <span className="text-4xl" aria-hidden>🤝</span>
          <div>
            <p className="font-display text-xl font-extrabold">{name}</p>
            <p className="text-xs text-sub">
              {together.length} {together.length === 1 ? "show" : "shows"} together
              {years.size > 1 ? ` across ${years.size} years` : ""}
              {spent > 0 ? ` · $${Math.round(spent).toLocaleString()} in tickets combined` : ""}
            </p>
          </div>
        </div>

        {together.length === 0 && (
          <p className="py-8 text-center text-xs text-sub">
            No shows tagged with {name} yet — add them from any concert&apos;s CREW section.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {together.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/concert/${c.id}`)}
              className="pressable flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{c.artist}</p>
                <p className="truncate text-xs text-sub">{c.venue} · {c.dateDisplay}</p>
              </div>
              <span className="shrink-0 text-sub" aria-hidden>▸</span>
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
