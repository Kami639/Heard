"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Music2, Disc3, Trophy, Images, ListOrdered } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { LcdStat } from "@/components/lcd/LcdStat";
import { useConcerts } from "@/lib/useConcerts";
import { getConcerts, daysUntil } from "@/lib/store";
import { uniqueShowCount, splitArtists } from "@/features/concerts/data";
import type { ConcertRec } from "@/features/concerts/data";

export default function Home() {
  const router = useRouter();
  const concerts = useConcerts();

  const attended = concerts.filter((c) => !c.cancelled);
  const latest = concerts[0];
  const cities = new Set(attended.map((c) => c.city)).size;
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    const artists = [...new Set(concerts.flatMap((c) => splitArtists(c.artist)))].slice(0, 8);
    if (!artists.length) return;
    const ac = new AbortController();
    fetch(`/api/upcoming?artists=${encodeURIComponent(artists.join("|"))}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setUpcoming(d.shows ?? []))
      .catch(() => {});
    return () => ac.abort();
  }, [concerts.length]);

  const today = new Date();
  const capsule = attended.find((c) => {
    const d = new Date(c.dateDisplay);
    return !isNaN(+d) && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });
  const capsuleYears = capsule ? today.getFullYear() - new Date(capsule.dateDisplay).getFullYear() : 0;
  const songs = attended.reduce((s, c) => s + c.setlist.length, 0);

  return (
    <AppShell count={concerts.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        {latest ? (
          <button
            onClick={() => router.push(`/concert/${latest.id}`)}
            className="pressable overflow-hidden rounded-2xl bg-card text-left"
          >
            <Art c1={latest.c1} c2={latest.c2} initials={latest.initials} imageUrl={latest.imageUrl} artists={latest.artists} className="rounded-none border-0" />
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-display text-xl font-bold">{latest.artist}</div>
                <div className="text-sm text-sub">{latest.tour}</div>
                <div className="mt-0.5 text-xs text-sub">{latest.city} · {latest.dateDisplay}</div>
                {daysUntil(latest.dateDisplay) !== null && (
                  <span className="mt-1 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                    in {daysUntil(latest.dateDisplay)} {daysUntil(latest.dateDisplay) === 1 ? "day" : "days"}
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

        {upcoming.length > 0 && (
          <div className="fade-up">
            <p className="pb-2 pl-1 text-xs font-semibold tracking-wide text-accent">COMING UP</p>
            <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.slice(0, 8).map((u, i) => {
                const days = Math.ceil((+new Date(u.date) - Date.now()) / 86400000);
                return (
                  <button
                    key={`${u.artist}-${u.date}-${i}`}
                    onClick={() => router.push(`/tour/${encodeURIComponent(u.tour)}?artist=${encodeURIComponent(u.artist)}`)}
                    className="pressable min-w-[150px] snap-start rounded-2xl bg-card p-3 text-left"
                  >
                    <p className="truncate text-[13px] font-semibold">{u.artist}</p>
                    <p className="truncate text-[11px] text-sub">{u.city}</p>
                    <p className="truncate text-[11px] text-sub">{u.venue}</p>
                    <p className="pt-1 text-[11px] font-semibold text-accent">
                      {days <= 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {capsule && (
          <button
            onClick={() => router.push(`/concert/${capsule.id}`)}
            className="pressable fade-up rounded-2xl bg-card p-4 text-left"
          >
            <p className="text-xs font-semibold tracking-wide text-accent">⏳ ON THIS NIGHT</p>
            <p className="pt-1 text-[15px]">
              <span className="font-semibold">{capsuleYears} {capsuleYears === 1 ? "year" : "years"} ago</span> — {capsule.artist} · {capsule.city}
            </p>
          </button>
        )}
        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Shows" value={uniqueShowCount(concerts)} />
          <LcdStat label="Cities" value={cities} />
          <LcdStat label="Songs" value={songs} />
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {[
            { label: "Songs Heard", href: "/songs", icon: Music2 },
            { label: "Wrapped", href: "/wrapped", icon: Disc3 },
            { label: "Achievements", href: "/achievements", icon: Trophy },
            { label: "Gallery", href: "/gallery", icon: Images },
            { label: "Lists", href: "/lists", icon: ListOrdered },
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
