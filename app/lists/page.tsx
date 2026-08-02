"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Art } from "@/components/Art";
import { useConcerts } from "@/lib/useConcerts";
import { getLists, createList, deleteList, toggleInList, type ConcertList } from "@/lib/lists";
import { getRanking } from "@/lib/ranking";

export default function Lists() {
  const router = useRouter();
  const concerts = useConcerts();
  const [lists, setLists] = useState<ConcertList[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setLists(getLists());
    load();
    window.addEventListener("heard-sync", load);
    return () => window.removeEventListener("heard-sync", load);
  }, []);

  const ranked = getRanking();
  const byId = new Map(concerts.map((c) => [c.id, c]));

  return (
    <AppShell title="lists" count={lists.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-2">
        <button
          onClick={() => {
            const name = prompt("Name this list", "Best encores I've seen");
            if (name?.trim()) createList(name);
          }}
          className="pressable rounded-xl bg-accent py-2.5 text-sm font-bold text-black"
        >
          ＋ New list
        </button>

        {ranked.length >= 2 && (
          <button
            onClick={() => router.push("/ranked")}
            className="pressable rounded-2xl bg-gradient-to-br from-card to-card2 p-4 text-left"
          >
            <p className="text-[13px] font-semibold">🏆 Your ranking</p>
            <p className="pt-0.5 text-xs text-sub">
              {ranked.length} shows ranked best to worst · #1 is {byId.get(ranked[0])?.artist ?? "—"}
            </p>
          </button>
        )}

        {lists.length === 0 && (
          <p className="pt-8 text-center text-sm text-sub">
            Lists are yours to invent — &ldquo;shows I cried at&rdquo;, &ldquo;festival sets I&apos;ll never forget&rdquo;,
            a bucket list of who&apos;s left to see.
          </p>
        )}

        {lists.map((l) => {
          const items = l.concertIds.map((id) => byId.get(id)).filter(Boolean);
          const expanded = open === l.id;
          return (
            <div key={l.id} className="overflow-hidden rounded-2xl bg-card">
              <button
                onClick={() => setOpen(expanded ? null : l.id)}
                className="pressable flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{l.name}</span>
                  <span className="block text-xs text-sub">{items.length} {items.length === 1 ? "show" : "shows"}</span>
                </span>
                <span className="shrink-0 text-sub">{expanded ? "▾" : "▸"}</span>
              </button>

              {expanded && (
                <div className="border-t border-hairline">
                  {items.map((c) => (
                    <button
                      key={c!.id}
                      onClick={() => router.push(`/concert/${c!.id}`)}
                      className="pressable flex w-full items-center gap-3 border-b border-hairline/50 px-4 py-2.5 text-left"
                    >
                      <span className="w-9 shrink-0">
                        <Art c1={c!.c1} c2={c!.c2} initials={c!.initials} imageUrl={c!.imageUrl} artists={c!.artists} className="rounded-lg" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c!.artist}</span>
                        <span className="block truncate text-[11px] text-sub">{c!.venue} · {c!.dateDisplay}</span>
                      </span>
                    </button>
                  ))}

                  {adding === l.id ? (
                    <div className="max-h-64 overflow-y-auto">
                      {concerts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => toggleInList(l.id, c.id)}
                          className="pressable flex w-full items-center justify-between gap-2 border-b border-hairline/50 px-4 py-2 text-left text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate">{c.artist} · {c.dateDisplay}</span>
                          <span className="shrink-0 text-accent">{l.concertIds.includes(c.id) ? "✓" : "＋"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-2 p-3">
                    <button
                      onClick={() => setAdding(adding === l.id ? null : l.id)}
                      className="pressable flex-1 rounded-lg bg-card2 py-2 text-xs text-accent"
                    >
                      {adding === l.id ? "Done adding" : "Add shows"}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${l.name}"?`)) deleteList(l.id); }}
                      className="pressable rounded-lg bg-card2 px-4 py-2 text-xs text-sub"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
