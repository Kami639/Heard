"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getConcerts } from "@/lib/store";
import { setPreview } from "@/lib/previewStore";
import type { ConcertRec } from "@/features/concerts/data";

const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fades sections in as they scroll into view. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setShown(true), io.disconnect()),
      { rootMargin: "-40px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
    >
      {children}
    </div>
  );
}

export default function TourPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = use(params);
  const name = decodeURIComponent(raw);
  const artistParam = useSearchParams().get("artist") ?? "";
  const router = useRouter();

  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [mine, setMine] = useState<ConcertRec[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMine(getConcerts().filter((c) => nk(c.tour ?? "") === nk(name)));
    fetch(`/api/tour?name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artistParam)}`)
      .then((r) => r.json())
      .then((d) => { setInfo(d.tour); if (d.tour?.image) setHero(d.tour.image); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`/api/artwork?artist=${encodeURIComponent(artistParam || name)}&tour=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => d.imageUrl && setHero((prev) => prev ?? d.imageUrl))
      .catch(() => {});
  }, [name, artistParam, attempt]);

  // parallax: art drifts slower than the page
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stats = info
    ? ([
        ["Shows", info.shows],
        ["Location", info.location],
        ["Album", info.album],
        ["Gross", info.gross],
        ["Attendance", info.attendance],
        ["Legs", info.legs],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return (
    <AppShell title="tour">
      <div className="flex flex-1 flex-col gap-5 pb-8">
        {/* hero with parallax art */}
        <div className="relative h-52 overflow-hidden">
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              className="absolute inset-x-0 top-0 h-72 w-full object-cover"
              style={{ transform: `translateY(${scrollY * -0.25}px) scale(1.1)` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/20" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
            <h1 className="font-display text-[26px] font-extrabold leading-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.9)]">{name}</h1>
            {(info?.artist || artistParam) && (
              <button
                onClick={() => router.push(`/artist/${encodeURIComponent(info?.artist || artistParam)}`)}
                className="pressable text-sm font-semibold text-accent"
              >
                {info?.artist || artistParam} ▸
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5">
          {loading && <p className="py-8 text-center text-sm text-sub">Pulling tour details…</p>}

          {!loading && !info && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-sub">
                {reason === "http" || reason === "fetch-threw" || reason === "api-error"
                  ? "Couldn't reach Wikipedia just now."
                  : reason === "artist-mismatch"
                  ? "Found an article but it didn't match this artist — skipped it rather than show you the wrong tour."
                  : "No tour details found — not every tour has an article yet."}
              </p>
              <button
                onClick={() => { setLoading(true); setReason(null); setAttempt((a) => a + 1); }}
                className="pressable rounded-full bg-card px-4 py-2 text-xs text-accent"
              >
                Try again
              </button>
              <a
                href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sub underline"
              >
                Look it up on Wikipedia ▸
              </a>
            </div>
          )}

          {info?.summary && (
            <Reveal><p className="text-sm leading-relaxed text-sub">{info.summary}</p></Reveal>
          )}

          {stats.length > 0 && (
            <Reveal>
              {/* horizontal scroll strip */}
              <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {stats.map(([k, v]) => (
                  <div key={k} className="min-w-[128px] snap-start rounded-2xl bg-gradient-to-br from-card to-card2 p-4">
                    <p className="text-[10px] uppercase tracking-wide text-sub">{k}</p>
                    <p className="pt-0.5 font-display text-lg font-bold leading-tight text-accent">{v}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {info?.supportActs?.length > 0 && (
            <Reveal delay={60}>
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-sub">Supporting acts</h2>
              <div className="flex flex-wrap gap-2">
                {info.supportActs.map((a: string) => (
                  <button
                    key={a}
                    onClick={() => router.push(`/artist/${encodeURIComponent(a)}`)}
                    className="pressable rounded-full bg-card px-3 py-1.5 text-xs font-medium"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {mine.length > 0 && (
            <Reveal delay={80}>
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-accent">You were there</h2>
              <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
                {mine.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/concert/${c.id}`)}
                    className="pressable flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{c.venue} · {c.city}</span>
                    <span className="shrink-0 text-xs text-sub">{c.dateDisplay}</span>
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {info?.sets?.length > 0 && (
            <Reveal delay={60}>
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-sub">Set lists</h2>
              <p className="pb-2 text-[11px] text-sub">From one show — not every night matched this.</p>
              {/* each artist's set is its own horizontally-scrolled card */}
              <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {info.sets.map((set: any, i: number) => (
                  <div key={i} className="min-w-[240px] max-w-[280px] snap-start rounded-2xl bg-card p-4">
                    {set.artist && (
                      <button
                        onClick={() => router.push(`/artist/${encodeURIComponent(set.artist)}`)}
                        className="pressable pb-2 text-sm font-bold text-accent"
                      >
                        {set.artist}
                      </button>
                    )}
                    <ol className="flex list-none flex-col gap-1">
                      {set.songs.map((song: string, j: number) => (
                        <li key={j} className="flex gap-2 text-xs">
                          <span className="w-4 shrink-0 text-right font-mono text-sub">{j + 1}</span>
                          <span className="min-w-0 flex-1">{song}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {info?.dates?.length > 0 && (
            <Reveal delay={60}>
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-sub">
                Tour dates <span className="text-accent">{info.dates.length}</span>
              </h2>
              <div className="flex max-h-80 flex-col divide-y divide-hairline overflow-y-auto rounded-2xl bg-card">
                {info.dates.map((d: any, i: number) => {
                  const mineHere = mine.find(
                    (c) => nk(c.city) === nk(d.city) || (nk(d.venue) && nk(c.venue) === nk(d.venue))
                  );
                  const open = () => {
                    if (mineHere) { router.push(`/concert/${mineHere.id}`); return; }
                    // build an addable show straight from the tour table
                    const songs = (info.sets ?? []).flatMap((set: any) => set.songs ?? []);
                    setPreview({
                      id: `wiki-${nk(name)}-${i}`,
                      artist: info.artist ?? artistParam ?? name,
                      tour: info.title ?? name,
                      venue: d.venue || "Unknown venue",
                      city: d.city,
                      country: d.country ?? "",
                      dateDisplay: d.date,
                      year: Number((d.date.match(/\d{4}/) ?? [])[0]) || new Date().getFullYear(),
                      setlist: songs,
                      setlistFromWiki: true,
                      wikiSourced: true,
                      openers: d.openers ?? [],
                      attendance: d.attendance ?? null,
                      cancelled: Boolean(d.cancelled),
                      c1: "#3a3a3c", c2: "#1c1c1e",
                      initials: (info.artist ?? name)[0]?.toUpperCase() ?? "?",
                      imageUrl: hero,
                      rating: 5, price: 0, photos: 0, notes: "",
                    });
                    router.push("/preview");
                  };
                  return (
                    <button
                      key={i}
                      onClick={open}
                      className={`pressable flex w-full items-start gap-3 px-4 py-2.5 text-left ${mineHere ? "bg-accent/10" : ""}`}
                    >
                      <span className="w-[74px] shrink-0 text-[11px] leading-tight text-sub">{d.date}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{d.city}</span>
                        <span className="block truncate text-[11px] text-sub">{d.venue}</span>
                        {d.openers?.length ? (
                          <span className="block truncate text-[10px] text-sub">w/ {d.openers.join(", ")}</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        {d.attendance && (
                          <span className="text-[10px] text-sub">{d.attendance.split("/")[0].trim()}</span>
                        )}
                        <span className="text-[11px] text-accent">{mineHere ? "✓" : "＋"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          )}

          {info?.guests?.length > 0 && (
            <Reveal delay={60}>
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-sub">Guest performers</h2>
              <div className="flex flex-wrap gap-2">
                {info.guests.map((g: any, i: number) => (
                  <button
                    key={`${g.name}-${i}`}
                    onClick={() => router.push(`/artist/${encodeURIComponent(g.name)}`)}
                    className="pressable max-w-[200px] truncate rounded-full bg-card px-3 py-1.5 text-xs"
                  >
                    🎤 {g.name}
                    {g.places?.[0] && <span className="text-sub"> · {g.places[0]}</span>}
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {(info?.prevTour || info?.nextTour) && (
            <Reveal delay={60}>
              <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-sub">Tour chronology</h2>
              <div className="flex items-stretch gap-2">
                {[info.prevTour, name, info.nextTour].map((t, i) =>
                  t ? (
                    <button
                      key={i}
                      disabled={i === 1}
                      onClick={() => router.push(`/tour/${encodeURIComponent(t)}?artist=${encodeURIComponent(info?.artist ?? artistParam)}`)}
                      className={`pressable flex-1 rounded-xl px-3 py-2.5 text-[11px] leading-tight ${
                        i === 1 ? "bg-accent font-bold text-black" : "bg-card text-sub"
                      }`}
                    >
                      {t}
                    </button>
                  ) : null
                )}
              </div>
            </Reveal>
          )}

          {info?.url && (
            <a href={info.url} target="_blank" rel="noopener noreferrer" className="pb-4 text-center text-[11px] text-sub underline">
              Tour details from Wikipedia ▸
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}
