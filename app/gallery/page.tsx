"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getConcerts } from "@/lib/store";
import { getMedia } from "@/lib/media";
import type { ConcertRec } from "@/features/concerts/data";

interface Shot {
  key: string;
  url: string;
  type: "image" | "video";
  concert: ConcertRec;
}

export default function Gallery() {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Shot | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let revoked: string[] = [];
    (async () => {
      const concerts = getConcerts();
      const out: Shot[] = [];
      for (const c of concerts) {
        for (const m of c.media ?? []) {
          if (m.url) { out.push({ key: m.id, url: m.url, type: m.type, concert: c }); continue; }
          const blob = await getMedia(m.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            revoked.push(url);
            out.push({ key: m.id, url, type: m.type, concert: c });
          }
        }
        (c.photosData ?? []).forEach((src, i) =>
          out.push({ key: `${c.id}-legacy-${i}`, url: src, type: "image", concert: c })
        );
      }
      out.sort((a, b) => +new Date(b.concert.dateDisplay) - +new Date(a.concert.dateDisplay));
      setShots(out);
      setLoading(false);
    })();
    return () => revoked.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // group by year for a bit of shape
  const byYear = shots.reduce<Record<number, Shot[]>>((acc, s) => {
    (acc[s.concert.year] ??= []).push(s);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <AppShell title="gallery" count={shots.length}>
      <section className="flex flex-1 flex-col gap-5 px-5 pb-8 pt-2">
        {loading && <p className="pt-10 text-center text-sm text-sub">Loading your memories…</p>}

        {!loading && shots.length === 0 && (
          <p className="pt-10 text-center text-sm text-sub">
            No photos yet — add some from any concert page and they&apos;ll all live here.
          </p>
        )}

        {years.map((year) => (
          <div key={year}>
            <h2 className="pb-2 pl-1 font-display text-lg font-bold">{year}</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {byYear[year].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setOpen(s)}
                  className="reveal pressable relative aspect-square overflow-hidden rounded-lg bg-card"
                >
                  {s.type === "video" ? (
                    <>
                      <video src={s.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-paper">▶</span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {open && (
        <div className="fixed lg:absolute inset-0 z-[90] flex flex-col bg-black/95">
          <button onClick={() => setOpen(null)} className="absolute inset-0" aria-label="Close" />
          <div className="pointer-events-none relative flex flex-1 items-center justify-center p-4">
            {open.type === "video" ? (
              <video src={open.url} controls autoPlay playsInline className="pointer-events-auto max-h-full max-w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.url} alt="" className="max-h-full max-w-full rounded-lg" />
            )}
          </div>
          <button
            onClick={() => router.push(`/concert/${open.concert.id}`)}
            className="pressable relative z-10 mx-5 mb-8 rounded-xl bg-card px-4 py-3 text-left"
          >
            <p className="truncate text-sm font-semibold">{open.concert.artist}</p>
            <p className="truncate text-xs text-sub">
              {open.concert.venue} · {open.concert.city} · {open.concert.dateDisplay}
            </p>
          </button>
        </div>
      )}
    </AppShell>
  );
}
