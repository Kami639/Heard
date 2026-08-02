"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts } from "@/lib/store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

function Row({ c, onOpen }: { c: ConcertRec; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left">
      <div className="w-10 shrink-0"><Art c1={c.c1} c2={c.c2} initials={c.initials} imageUrl={c.imageUrl} artists={c.artists} className="rounded-lg" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{c.tour}</div>
        <div className="truncate text-xs text-sub">{c.venue} · {c.city} · {c.dateDisplay}</div>
      </div>
      <Stars n={c.rating} />
    </button>
  );
}

export default function ArtistPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = use(params);
  const name = decodeURIComponent(raw);
  const router = useRouter();
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [tours, setTours] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<any | null>(null);
  const [info, setInfo] = useState<{ imageUrl: string | null; genres: string[]; popularity: number; followers: number } | null>(null);

  useEffect(() => {
    const load = () => setConcerts(getConcerts());
    load();
    window.addEventListener("heard-sync", load);
    return () => window.removeEventListener("heard-sync", load);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/artist?name=${encodeURIComponent(name)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then(({ artist }) => artist && setInfo({
        imageUrl: artist.imageUrl ?? null,
        genres: artist.genres ?? [],
        popularity: artist.popularity ?? 0,
        followers: artist.followers ?? 0,
      }))
      .catch(() => {});
    return () => ac.abort();
  }, [name]);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/tours?artist=${encodeURIComponent(name)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setTours(d.tours ?? []))
      .catch(() => {});
    return () => ac.abort();
  }, [name]);

  const attended = concerts.filter((c) => !c.cancelled);
  const headline = attended.filter((c) => splitArtists(c.artist).some((a) => norm(a) === norm(name)));
  const pulledUp = attended.filter(
    (c) =>
      !headline.includes(c) &&
      (c.guests ?? []).some((g) => norm(g) === norm(name))
  );
  const songsHeard = headline.reduce((s, c) => s + c.setlist.length, 0);
  const firstYear = headline.length ? Math.min(...headline.map((c) => c.year)) : null;
  const fmtFollowers = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

  return (
    <AppShell title="artist" count={headline.length + pulledUp.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="flex items-center gap-4 rounded-2xl bg-card p-4">
          {info?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.imageUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-card2 font-display text-2xl font-bold text-sub">
              {name[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-xl font-bold leading-tight">{name}</h1>
            {info && (
              <p className="pt-0.5 text-xs text-sub">
                {(info.popularity / 10).toFixed(1)}/10 popularity{info.followers ? ` · ${fmtFollowers(info.followers)} followers` : ""}
              </p>
            )}
            {info?.genres?.length ? (
              <div className="flex flex-wrap gap-1 pt-1.5">
                {info.genres.slice(0, 3).map((g) => (
                  <span key={g} className="rounded-full bg-card2 px-2 py-0.5 text-[10px] capitalize text-accent">{g}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Times seen" value={headline.length} />
          <LcdStat label="Songs heard" value={songsHeard} />
          <LcdStat label="First seen" value={firstYear ?? "—"} />
        </div>

        {coverage && coverage.catalogue > 0 && (
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold">Their catalogue, live</p>
              <p className="font-display text-xl font-extrabold text-accent">{coverage.percent}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-card2">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${coverage.percent}%` }} />
            </div>
            <p className="pt-1.5 text-[11px] text-sub">
              You&apos;ve heard {coverage.heard} of their {coverage.catalogue} known songs performed live.
            </p>
          </div>
        )}

        {tours.length > 0 && (
          <div>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">TOURS</h2>
            <div className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tours.map((t) => {
                const went = headline.some((c) => norm(c.tour ?? "") === norm(t));
                return (
                  <button
                    key={t}
                    onClick={() => router.push(`/tour/${encodeURIComponent(t)}?artist=${encodeURIComponent(name)}`)}
                    className={`pressable min-w-[150px] snap-start rounded-2xl p-3 text-left text-xs leading-tight ${
                      went ? "bg-accent/15 text-accent" : "bg-card text-sub"
                    }`}
                  >
                    {went && <span className="pr-1">✓</span>}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {headline.length > 0 && (
          <div>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">SHOWS</h2>
            <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {headline.map((c) => <Row key={c.id} c={c} onOpen={() => router.push(`/concert/${c.id}`)} />)}
            </div>
          </div>
        )}

        {pulledUp.length > 0 && (
          <div>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">PULLED UP 🎤</h2>
            <p className="pb-2 pl-1 text-xs text-sub">Shows where {name} came out as a guest</p>
            <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {pulledUp.map((c) => <Row key={c.id} c={c} onOpen={() => router.push(`/concert/${c.id}`)} />)}
            </div>
          </div>
        )}

        {headline.length + pulledUp.length === 0 && (
          <p className="pt-8 text-center text-sm text-sub">You haven&apos;t caught {name} live yet.</p>
        )}
      </section>
    </AppShell>
  );
}
