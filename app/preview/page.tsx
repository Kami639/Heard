"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { claimPlayback, isCurrent, playUrl, stopAudio } from "@/lib/audio";
import { Art } from "@/components/Art";
import { addConcert, getConcerts } from "@/lib/store";
import { getPreview, clearPreview } from "@/lib/previewStore";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

export default function Preview() {
  const router = useRouter();
  const [rec, setRec] = useState<ConcertRec | null>(null);
  const [tourInfo, setTourInfo] = useState<any | null>(null);
  const [venueImg, setVenueImg] = useState<string | null>(null);
  const [legInfo, setLegInfo] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingSong, setLoadingSong] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Record<string, string | null>>({});

  useEffect(() => {
    setRec(getPreview());
    return () => stopAudio();
  }, []);

  useEffect(() => {
    if (!rec) return;
    if (rec.tour) {
      fetch(`/api/tour?name=${encodeURIComponent(rec.tour)}&artist=${encodeURIComponent(splitArtists(rec.artist)[0] ?? rec.artist)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.tour) return;
          setTourInfo(d.tour);
          // where this night sits on the tour
          const dates: any[] = d.tour.dates ?? [];
          if (dates.length) {
            const mine = new Date(rec.dateDisplay);
            const idx = dates.findIndex((x) => {
              const dt = new Date(x.date);
              return !isNaN(+dt) && dt.toDateString() === mine.toDateString();
            });
            if (idx >= 0) setLegInfo(`Show ${idx + 1} of ${dates.length} on this tour`);
          }
        })
        .catch(() => {});
    }
    fetch(`/api/venue?name=${encodeURIComponent(rec.venue)}&city=${encodeURIComponent(rec.city)}`)
      .then((r) => r.json()).then((d) => d.imageUrl && setVenueImg(d.imageUrl)).catch(() => {});
  }, [rec?.id]);

  async function toggle(song: string) {
    if (!rec) return;
    if (playing === song) { stopAudio(); setPlaying(null); return; }
    const token = claimPlayback();
    setPlaying(null);
    setLoadingSong(song);
    let url = cache.current[song];
    if (url === undefined) {
      try {
        const performer = rec.songArtists?.[song] ?? splitArtists(rec.artist)[0] ?? rec.artist;
        const cov = rec.covers?.[song];
        const r = await fetch(`/api/preview?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(performer)}${cov ? `&cover=${encodeURIComponent(cov)}` : ""}`);
        url = (await r.json()).previewUrl ?? null;
      } catch { url = null; }
      if (url) cache.current[song] = url;
    }
    setLoadingSong(null);
    if (!url) return;
    if (!isCurrent(token)) return;
    if (playUrl(url, token, () => setPlaying(null))) setPlaying(song);
  }

  if (!rec) {
    return (
      <AppShell title="preview">
        <p className="px-8 pt-16 text-center text-sm text-sub">Nothing to preview — pick a show from search.</p>
      </AppShell>
    );
  }

  const dupe = getConcerts().find((c) => c.id.startsWith(rec.id));

  const add = () => {
    const c: ConcertRec = { ...rec, id: `${rec.id}-${Date.now()}`, rating: 5, price: 0, photos: 0, notes: "" };
    addConcert(c);
    clearPreview();
    router.push(`/concert/${c.id}?added=1`);
  };

  return (
    <AppShell title="preview">
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-2">
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="pressable flex-1 rounded-xl bg-card2 py-3 text-sm font-semibold text-sub"
          >
            Back
          </button>
          <button
            onClick={add}
            className="pressable flex-[1.6] rounded-xl bg-accent py-3 text-sm font-bold text-black shadow-lg shadow-accent/25"
          >
            {dupe ? "Add anyway" : "＋ Add to archive"}
          </button>
        </div>
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <Art c1={rec.c1} c2={rec.c2} initials={rec.initials} imageUrl={rec.imageUrl} artists={rec.artists} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-baseline gap-x-1.5 break-words font-display text-xl font-bold leading-tight">
              {splitArtists(rec.artist).map((a, i, arr) => (
                <span key={a}>
                  <button
                    onClick={() => router.push(`/artist/${encodeURIComponent(a)}`)}
                    className="pressable hover:text-accent"
                  >
                    {a}
                  </button>
                  {i < arr.length - 1 && <span className="text-sub"> &</span>}
                </span>
              ))}
            </h1>
            {rec.tour && (
              <button
                onClick={() => router.push(`/tour/${encodeURIComponent(rec.tour!)}?artist=${encodeURIComponent(splitArtists(rec.artist)[0] ?? rec.artist)}`)}
                className="pressable pt-0.5 text-sm text-accent"
              >
                {rec.tour} ▸
              </button>
            )}
            <p className="pt-1 text-sm text-sub">{rec.venue}</p>
            <p className="text-sm text-sub">{rec.city}{rec.country ? `, ${rec.country}` : ""}</p>
            <p className="text-sm text-sub">{rec.dateDisplay}</p>
            {rec.cancelled && <p className="pt-1 text-xs font-semibold text-accent">⚠ Cancelled show</p>}
            {legInfo && <p className="pt-1 text-xs text-accent">{legInfo}</p>}
            {rec.openers?.length ? (
              <p className="pt-1 text-xs text-sub">Opened by {rec.openers.join(", ")}</p>
            ) : null}
            {rec.attendance && <p className="text-xs text-sub">{rec.attendance} attendance</p>}
          </div>
        </div>

        {venueImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venueImg} alt={rec.venue} className="h-32 w-full rounded-2xl object-cover" />
        )}

        {tourInfo && (
          <div className="rounded-2xl bg-card p-4">
            {tourInfo.summary && <p className="text-xs leading-relaxed text-sub">{tourInfo.summary}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {[["Shows", tourInfo.shows], ["Gross", tourInfo.gross], ["Attendance", tourInfo.attendance]]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k as string} className="rounded-full bg-card2 px-3 py-1 text-[11px]">
                    <span className="text-sub">{k as string} </span>
                    <span className="font-semibold text-accent">{v as string}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-sub">
            Setlist {rec.setlist.length > 0 && <span className="text-accent">{rec.setlist.length} songs</span>}
          </h2>
          {(rec.wikiSourced || rec.setlistFromWiki) && rec.setlist.length > 0 && (
            <p className="pb-2 text-[11px] text-sub">
              From Wikipedia — representative of this tour, not verified for this exact night. You can edit it after adding.
            </p>
          )}
          {rec.setlist.length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-sub">
              No setlist logged for this night yet — you can still add the show.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {rec.setlist.map((s, i) => (
                <button key={`${s}-${i}`} onClick={() => toggle(s)} className="pressable flex items-center gap-3 px-4 py-2.5 text-left">
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-sub">{i + 1}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card2 text-[11px] text-accent">
                    {loadingSong === s ? "…" : playing === s ? "❚❚" : "▶"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${playing === s ? "font-semibold text-accent" : ""}`}>{s}</span>
                  {rec.songArtists?.[s] && (rec.artists?.length ?? 0) > 1 && (
                    <span className="max-w-[90px] shrink-0 truncate text-[10px] text-sub">{rec.songArtists[s]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={add}
          className="pressable mt-2 w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25"
        >
          {dupe ? "Add anyway" : "＋ Add to archive"}
        </button>
      </div>
    </AppShell>
  );
}
