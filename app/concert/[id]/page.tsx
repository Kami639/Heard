"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { claimPlayback, isCurrent, playUrl, stopAudio } from "@/lib/audio";
import { Art, Stars } from "@/components/Art";
import { getConcerts, updateConcert, deleteConcert, daysUntil } from "@/lib/store";
import { splitArtists } from "@/features/concerts/data";
import { saveMedia, getMedia, deleteMedia } from "@/lib/media";
import { downloadShareCard } from "@/lib/shareCard";
import { useRef } from "react";
import type { ConcertRec } from "@/features/concerts/data";

function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="px-6 pt-4">
      <div className="mb-1.5 flex items-center justify-between border-t border-hairline pt-2">
        <span className="font-mono text-[11px] tracking-[0.2em] text-sub">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Concert({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [toast, setToast] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [footage, setFootage] = useState<{ videoId: string; title: string; thumbnail: string; channel: string }[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playingSong, setPlayingSong] = useState<string | null>(null);
  const [loadingSong, setLoadingSong] = useState<string | null>(null);
  const [songStatus, setSongStatus] = useState<Record<string, "unreleased" | "no_preview">>({});
  const [songCover, setSongCover] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [venueImg, setVenueImg] = useState<string | null>(null);
  const [tourInfo, setTourInfo] = useState<any | null>(null);
  const [legInfo, setLegInfo] = useState<string | null>(null);
  const [lineupMsg, setLineupMsg] = useState<string | null>(null);
  const [editingSetlist, setEditingSetlist] = useState(false);
  const [editingLineup, setEditingLineup] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewCache = useRef<Record<string, string | null>>({});

  const stopSong = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingSong(null);
  };

  async function toggleSong(song: string, artist: string) {
    if (playingSong === song) { stopSong(); return; }
    stopSong();
    setLoadingSong(song);
    const ck = `${song}::${artist}`;
    let url = previewCache.current[ck];
    if (url === undefined) {
      try {
        const cov = c?.covers?.[song];
        const r = await fetch(`/api/preview?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}${cov ? `&cover=${encodeURIComponent(cov)}` : ""}`);
        const data = await r.json();
        url = data.previewUrl ?? null;
        if (data.coverArtist || cov) setSongCover((m) => ({ ...m, [song]: data.coverArtist ?? cov }));
        if (!url) {
          setSongStatus((m) => ({ ...m, [song]: data.status === "not_found" ? "unreleased" : "no_preview" }));
          if (data.status === "not_found") import("@/features/achievements").then((m) => m.unlockUnreleasedAchievement());
        }
      } catch { url = null; }
      if (url) previewCache.current[ck] = url; // failures retry next tap
    }
    setLoadingSong(null);
    if (!url) { setPlayingSong(null); return; }
    const audio = new Audio(url);
    audio.onended = () => setPlayingSong(null);
    audioRef.current = audio;
    setPlayingSong(song);
    audio.play().catch(() => setPlayingSong(null));
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("added")) {
      setToast(true);
      window.history.replaceState(null, "", window.location.pathname);
      const t = setTimeout(() => setToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);
  useEffect(() => {
    const load = () => setConcerts(getConcerts());
    load();
    window.addEventListener("heard-sync", load);
    return () => window.removeEventListener("heard-sync", load);
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const cRef = concerts.find((x) => x.id === id);

  useEffect(() => {
    if (!cRef?.tour) return;
    fetch(`/api/tour?name=${encodeURIComponent(cRef.tour)}&artist=${encodeURIComponent(cRef.artist)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.tour) return;
        setTourInfo(d.tour);
        const dates: any[] = d.tour.dates ?? [];
        const mine = new Date(cRef!.dateDisplay);
        const idx = dates.findIndex((x) => {
          const dt = new Date(x.date);
          return !isNaN(+dt) && dt.toDateString() === mine.toDateString();
        });
        if (idx >= 0) setLegInfo(`Show ${idx + 1} of ${dates.length} on this tour`);
      })
      .catch(() => {});
  }, [cRef?.id]);

  useEffect(() => {
    if (!cRef) return;
    fetch(`/api/venue?name=${encodeURIComponent(cRef.venue)}&city=${encodeURIComponent(cRef.city)}`)
      .then((r) => r.json())
      .then((d) => d.imageUrl && setVenueImg(d.imageUrl))
      .catch(() => {});
  }, [cRef?.id]);

  // Complete the lineup: pull in every other act who played that night and
  // merge their sets, so a package tour isn't filed under one artist.
  useEffect(() => {
    if (!cRef || cRef.lineupChecked || cRef.wikiSourced) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/lineup?venue=${encodeURIComponent(cRef.venue)}&city=${encodeURIComponent(cRef.city)}&tour=${encodeURIComponent(cRef.tour ?? "")}&date=${encodeURIComponent(
            new Date(cRef.dateDisplay).toISOString().slice(0, 10)
          )}`
        );
        const { acts } = await r.json();
        if (!Array.isArray(acts) || acts.length < 2) {
          updateConcert(cRef.id, { lineupChecked: true });
          setConcerts(getConcerts());
          return;
        }

        const known = new Set(splitArtists(cRef.artist).map((a) => a.toLowerCase()));
        const added = acts.filter((a: any) => !known.has(a.artist.toLowerCase()));

        const setlist = [...cRef.setlist];
        const songArtists: Record<string, string> = { ...(cRef.songArtists ?? {}) };
        for (const s of cRef.setlist) if (!songArtists[s]) songArtists[s] = splitArtists(cRef.artist)[0] ?? cRef.artist;
        const covers = { ...(cRef.covers ?? {}) };
        const guests = new Set(cRef.guests ?? []);

        for (const act of acts) {
          for (const song of act.songs) {
            if (!setlist.includes(song)) setlist.push(song);
            songArtists[song] = act.artist;
          }
          Object.assign(covers, act.covers ?? {});
          for (const g of act.guests ?? []) guests.add(g);
        }

        // billing ordered by set length (headliner first), photos fetched after
        const names = acts.map((a: any) => a.artist);
        const artists = await Promise.all(names.slice(0, 4).map(async (name: string) => {
          const existing = cRef.artists?.find((x) => x.name.toLowerCase() === name.toLowerCase());
          if (existing?.imageUrl) return existing;
          try {
            const ar = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
            return { name, imageUrl: (await ar.json()).artist?.imageUrl ?? null };
          } catch { return { name, imageUrl: null }; }
        }));

        updateConcert(cRef.id, {
          artist: names.length > 4 ? `${names.slice(0, 4).join(" & ")} & more` : names.join(" & "),
          artists,
          setlist,
          songArtists,
          covers,
          guests: [...guests],
          lineupChecked: true,
        });
        setConcerts(getConcerts());
        if (added.length) setLineupMsg(`Added ${added.length} more ${added.length === 1 ? "act" : "acts"} from that night`);
      } catch {
        updateConcert(cRef.id, { lineupChecked: true });
      }
    })();
  }, [cRef?.id]);

  // Self-heal: if art was missing (e.g. Spotify was rate-limited when added),
  // try again on open and save it once it comes back.
  useEffect(() => {
    if (!cRef) return;
    (async () => {
      try {
        // Tours get their official poster as cover art (once).
        if (cRef.tour && !cRef.tourArtChecked) {
          const tr = await fetch(
            `/api/artwork?artist=${encodeURIComponent(splitArtists(cRef.artist)[0] ?? cRef.artist)}&tour=${encodeURIComponent(cRef.tour)}`
          );
          const td = await tr.json();
          updateConcert(cRef.id, {
            tourArtChecked: true,
            ...(td.source === "wikipedia" && td.imageUrl ? { imageUrl: td.imageUrl } : {}),
          });
          setConcerts(getConcerts());
        }

        // Any performer credited on a song should have a face, including
        // ones added by the credit fixer.
        const credited = [...new Set(Object.values(cRef.songArtists ?? {}).flatMap((v) => splitArtists(v)))];
        const haveNames = new Set((cRef.artists ?? []).map((a) => a.name.toLowerCase()));
        const missingPeople = credited.filter((n) => !haveNames.has(n.toLowerCase()));
        const needPhotos = (cRef.artists ?? []).filter((a) => !a.imageUrl).map((a) => a.name);

        if (missingPeople.length || needPhotos.length) {
          const additions = await Promise.all([...missingPeople, ...needPhotos].slice(0, 5).map(async (name) => {
            try {
              const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
              return { name, imageUrl: (await r.json()).artist?.imageUrl ?? null };
            } catch { return { name, imageUrl: null }; }
          }));
          const merged = [...(cRef.artists ?? [])];
          for (const a of additions) {
            const i = merged.findIndex((x) => x.name.toLowerCase() === a.name.toLowerCase());
            if (i >= 0) { if (a.imageUrl) merged[i] = a; }
            else merged.push(a);
          }
          if (merged.some((a, i) => a.imageUrl !== (cRef.artists ?? [])[i]?.imageUrl) || merged.length !== (cRef.artists?.length ?? 0)) {
            updateConcert(cRef.id, { artists: merged });
            setConcerts(getConcerts());
          }
        }

        // Duo/multi-artist covers: re-fetch any missing member photos
        if (cRef.artists?.length) {
          if (cRef.artists.every((a) => a.imageUrl)) return;
          const updated = await Promise.all(cRef.artists.map(async (a) => {
            if (a.imageUrl) return a;
            try {
              const r = await fetch(`/api/artist?name=${encodeURIComponent(a.name)}`);
              return { ...a, imageUrl: (await r.json()).artist?.imageUrl ?? null };
            } catch { return a; }
          }));
          if (updated.some((a, i) => a.imageUrl !== cRef.artists![i].imageUrl)) {
            updateConcert(cRef.id, { artists: updated });
            setConcerts(getConcerts());
          }
          return;
        }
        // Solo covers: re-fetch tour/artist artwork
        if (cRef.imageUrl) return;
        const r = await fetch(
          `/api/artwork?artist=${encodeURIComponent(cRef.artist)}&tour=${encodeURIComponent(cRef.tour ?? "")}`
        );
        const url = (await r.json()).imageUrl;
        if (url) {
          updateConcert(cRef.id, { imageUrl: url });
          setConcerts(getConcerts());
        }
      } catch {}
    })();
  }, [cRef?.id]);
  useEffect(() => {
    if (!cRef) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/footage?artist=${encodeURIComponent(cRef.artist)}&venue=${encodeURIComponent(cRef.venue)}&date=${encodeURIComponent(cRef.dateDisplay)}`
        );
        setFootage((await r.json()).videos ?? []);
      } catch { setFootage([]); }
    })();
  }, [cRef?.artist, id]);

  const cForMedia = concerts.find((x) => x.id === id);
  useEffect(() => {
    let revoked: string[] = [];
    (async () => {
      const refs = cForMedia?.media ?? [];
      const urls: Record<string, string> = {};
      for (const m of refs) {
        if (m.url) { urls[m.id] = m.url; continue; } // synced from another device
        const blob = await getMedia(m.id);
        if (blob) { urls[m.id] = URL.createObjectURL(blob); revoked.push(urls[m.id]); }
      }
      setMediaUrls(urls);
    })();
    return () => revoked.forEach((u) => URL.revokeObjectURL(u));
  }, [cForMedia?.media?.length, id]);

  const idx = concerts.findIndex((c) => c.id === id);
  const c = concerts[idx];

  /** Re-check who performed each song against MusicBrainz. Fixes shows where
   *  everything got credited to the headliner (21 Savage songs under Drake). */
  async function fixCredits() {
    if (!c) return;
    const { fixConcertCredits } = await import("@/lib/credits");
    const changed = await fixConcertCredits(c, (done, total) => setFixing(`${done}/${total}`));
    setFixing(null);
    setConcerts(getConcerts());
    setLineupMsg(changed ? `Re-credited ${changed} ${changed === 1 ? "song" : "songs"}` : "Credits already looked right");
  }

  function removeMedia(mid: string) {
    if (!c) return;
    const gone = (c.media ?? []).find((m) => m.id === mid);
    if (gone?.url) import("@/lib/sync").then((m) => m.removeMediaRemote([gone.url])).catch(() => {});
    deleteMedia([mid]);
    const media = (c.media ?? []).filter((m) => m.id !== mid);
    updateConcert(c.id, { media, photos: media.length + (c.photosData?.length ?? 0) });
    setConcerts(getConcerts());
  }

  function removeLegacyPhoto(idx: number) {
    if (!c) return;
    const photosData = (c.photosData ?? []).filter((_, i) => i !== idx);
    updateConcert(c.id, { photosData, photos: photosData.length + (c.media?.length ?? 0) });
    setConcerts(getConcerts());
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!c) return;
    const files = [...(e.target.files ?? [])].slice(0, 6);
    const { uploadMedia } = await import("@/lib/sync");
    const added: { id: string; type: "image" | "video"; url?: string | null }[] = [];
    for (const f of files) {
      try {
        const isVideo = f.type.startsWith("video/");
        if (isVideo && f.size > 60 * 1024 * 1024) { alert(`${f.name} is over 60MB — trim it shorter.`); continue; }
        if (!isVideo && !f.type.startsWith("image/")) continue;
        const blob = isVideo ? f : await compressBlob(f);
        const id = await saveMedia(blob); // local always (instant + offline)
        const url = await uploadMedia(blob, id); // cloud when signed in
        added.push({ id, type: isVideo ? "video" : "image", url });
      } catch { alert("Couldn't save that one — storage may be full."); }
    }
    if (added.length) {
      const media = [...(c.media ?? []), ...added];
      updateConcert(c.id, { media, photos: media.length + (c.photosData?.length ?? 0) });
      setConcerts(getConcerts());
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const patch = (data: Partial<typeof c>) => {
    if (!c) return;
    updateConcert(c.id, data);
    setConcerts(getConcerts());
  };

  const del = () => {
    if (!c) return;
    if (confirm(`Delete ${c.artist} from your archive? This can't be undone.`)) {
      deleteMedia((c.media ?? []).map((m) => m.id));
      import("@/lib/sync").then((m) => m.removeMediaRemote((c.media ?? []).map((x) => x.url))).catch(() => {});
      deleteConcert(c.id);
      router.push("/archive");
    }
  };

  if (!c) return null;

  return (
    <AppShell count={concerts.length}>
      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          className="fixed lg:absolute inset-0 z-[90] flex items-center justify-center bg-black/95 p-4"
          aria-label="Close photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
        </button>
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center gap-2 lg:absolute lg:bottom-8">
          <div className="pointer-events-none animate-[toastIn_0.3s_ease-out] rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-accent/30">
            ✓ Memory saved
          </div>
          <button
            onClick={() => {
              let last = "";
              try { last = (JSON.parse(localStorage.getItem("heard.recent.v1") ?? "[]")[0] ?? ""); } catch {}
              router.push(`/add${last ? `?q=${encodeURIComponent(last)}` : ""}`);
            }}
            className="pressable animate-[toastIn_0.3s_ease-out] rounded-full bg-card px-4 py-2.5 text-sm font-semibold text-accent shadow-lg"
          >
            ＋ Add another
          </button>
        </div>
      )}
      <section className="flex-1 overflow-y-auto pb-4">
        <button
          onClick={() => router.push("/archive")}
          className="pressable flex items-center gap-1 px-5 pt-3 text-sm text-accent"
        >
          ‹ Archive
        </button>
        <div className={`flex flex-col items-center gap-3 px-6 pt-2 ${c.cancelled ? "opacity-60" : ""}`}>
          <div className="w-full max-w-64"><Art c1={c.c1} c2={c.c2} initials={c.initials} imageUrl={c.imageUrl} artists={c.artists} /></div>
          <div className="text-center">
            <button
              onClick={() => router.push(`/artist/${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`)}
              className="pressable max-w-full break-words px-2 font-display font-extrabold leading-tight"
              style={{ fontSize: `clamp(19px, ${Math.max(19, 34 - Math.max(0, c.artist.length - 12))}px, 28px)` }}
            >
              {c.artist}
            </button>
            {lineupMsg && <p className="px-4 pt-1 text-xs text-accent">✓ {lineupMsg}</p>}
          {c.openers?.length ? (
              <p className="px-4 pt-1 text-xs text-sub">Opened by {c.openers.join(", ")}</p>
            ) : null}
            {(c.guests?.length ?? 0) > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-1">
                {c.guests!.map((g) => (
                  <button
                    key={g}
                    onClick={() => router.push(`/artist/${encodeURIComponent(g)}`)}
                    className="pressable rounded-full bg-card px-2.5 py-1 text-[11px] text-accent"
                  >
                    🎤 {g} pulled up
                  </button>
                ))}
              </div>
            )}
            {c.tour ? (
              <button
                onClick={() => router.push(`/tour/${encodeURIComponent(c.tour)}?artist=${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`)}
                className="pressable max-w-full break-words px-2 text-sm text-accent"
              >
                {c.tour} ▸
              </button>
            ) : null}
            <div className="mt-0.5 max-w-full break-words px-2 font-mono text-xs text-sub">{c.venue} · {c.city}</div>
            <div className="font-mono text-xs text-sub">{c.dateDisplay}</div>
            {c.cancelled && (
              <span className="mt-1 inline-block rounded-full bg-card px-3 py-1 text-xs font-semibold text-sub">CANCELLED</span>
            )}
            {!c.cancelled && daysUntil(c.dateDisplay) !== null && (
              <span className="mt-1 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                in {daysUntil(c.dateDisplay)} {daysUntil(c.dateDisplay) === 1 ? "day" : "days"}
              </span>
            )}
            <div className="mt-1 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => patch({ rating: n })}
                  aria-label={`Rate ${n} stars`}
                  className={`text-2xl leading-none active:scale-90 ${n <= c.rating ? "text-accent" : "text-hairline"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 font-mono text-xs text-sub">
              <span>$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={c.price || ""}
                placeholder="0"
                onChange={(e) => patch({ price: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 border-b border-hairline bg-transparent text-center text-ink outline-none"
              />
              <span>on tickets</span>
            </div>
          </div>
        </div>

        {tourInfo && (
          <Section label="THE TOUR">
            <div className="flex flex-col gap-2.5">
              {legInfo && <p className="pb-1 text-xs font-semibold text-accent">{legInfo}</p>}
            {tourInfo.summary && <p className="text-xs leading-relaxed text-sub">{tourInfo.summary}</p>}
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Album", tourInfo.album],
                  ["Shows", tourInfo.shows],
                  ["Gross", tourInfo.gross],
                  ["Attendance", tourInfo.attendance],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-card2 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-sub">{k as string}</p>
                    <p className="truncate text-sm font-semibold">{v as string}</p>
                  </div>
                ))}
              </div>
              {tourInfo.supportActs?.length > 0 && (
                <div>
                  <p className="pb-1.5 text-[10px] uppercase tracking-wide text-sub">Opening acts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tourInfo.supportActs.map((a: string) => (
                      <button
                        key={a}
                        onClick={() => router.push(`/artist/${encodeURIComponent(a)}`)}
                        className="pressable rounded-full bg-card2 px-2.5 py-1 text-[11px] text-accent"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tourInfo.guests?.length > 0 && (() => {
                const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
                const here = tourInfo.guests.filter((g: any) =>
                  g.places?.some((pl: string) => nk(pl) && nk(c.city).includes(nk(pl)))
                );
                const elsewhere = tourInfo.guests.filter((g: any) => !here.includes(g));
                const already = new Set((c.guests ?? []).map(nk));
                return (
                  <div>
                    <p className="pb-1.5 text-[10px] uppercase tracking-wide text-sub">Surprise guests on this tour</p>
                    {here.length > 0 && (
                      <div className="flex flex-col gap-1.5 pb-2">
                        {here.map((g: any) => (
                          <div key={g.name} className="flex items-center gap-2 rounded-xl bg-card2 px-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-xs">
                              <span className="font-semibold">{g.name}</span>
                              <span className="text-sub"> · a {c.city} show</span>
                            </span>
                            {already.has(nk(g.name)) ? (
                              <span className="shrink-0 text-[11px] text-accent">✓ saw it</span>
                            ) : (
                              <button
                                onClick={() => {
                                  updateConcert(c.id, { guests: [...(c.guests ?? []), g.name] });
                                  setConcerts(getConcerts());
                                }}
                                className="pressable shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-black"
                              >
                                I saw this
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {elsewhere.slice(0, 12).map((g: any) => (
                        <span key={g.name} className="rounded-full bg-card2 px-2.5 py-1 text-[11px] text-sub">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {tourInfo.dates?.length > 1 && (
                <div>
                  <p className="pb-1.5 text-[10px] uppercase tracking-wide text-sub">
                    Other nights on this tour <span className="text-accent">{tourInfo.dates.length}</span>
                  </p>
                  <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {tourInfo.dates.map((d: any, i: number) => {
                      const isThis = new Date(d.date).toDateString() === new Date(c.dateDisplay).toDateString();
                      return (
                        <button
                          key={i}
                          onClick={() => router.push(`/tour/${encodeURIComponent(c.tour!)}?artist=${encodeURIComponent(splitArtists(c.artist)[0] ?? c.artist)}`)}
                          className={`min-w-[124px] snap-start rounded-xl p-2.5 text-left ${isThis ? "bg-accent/20" : "bg-card2"}`}
                        >
                          <span className="block truncate text-[11px] font-semibold">{d.city}</span>
                          <span className="block truncate text-[10px] text-sub">{d.venue}</span>
                          <span className="block truncate text-[10px] text-sub">{d.date}</span>
                          {isThis && <span className="text-[10px] font-semibold text-accent">you were here</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <a
                href={tourInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sub underline"
              >
                Tour details from Wikipedia ▸
              </a>
            </div>
          </Section>
        )}

        {venueImg && (
          <Section label="VENUE">
            <div className="overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={venueImg} alt={c.venue} loading="lazy" className="h-36 w-full object-cover" />
              <div className="bg-card px-3 py-2">
                <p className="text-sm font-semibold">{c.venue}</p>
                <p className="text-xs text-sub">{c.city}</p>
              </div>
            </div>
          </Section>
        )}

        {(c.setlist.length > 0 || (c.artists?.length ?? 0) > 1) && (
          <Section
            label="LINEUP"
            action={
              <span className="flex gap-3">
                <button onClick={fixCredits} disabled={!!fixing} className="pressable text-[11px] text-accent disabled:opacity-50">
                  {fixing ? "Checking…" : "Fix credits"}
                </button>
                <button onClick={() => setEditingLineup((v) => !v)} className="pressable text-[11px] text-accent">
                  {editingLineup ? "Done" : "Edit"}
                </button>
              </span>
            }
          >
            <div className="flex flex-wrap gap-2">
              {(c.artists ?? splitArtists(c.artist).map((name) => ({ name, imageUrl: null }))).map((a) => (
                <span key={a.name} className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1.5 text-xs">
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : null}
                  <button
                    onClick={() => router.push(`/artist/${encodeURIComponent(a.name)}`)}
                    className="pressable max-w-[130px] truncate"
                  >
                    {a.name}
                  </button>
                  {editingLineup && (
                    <button
                      onClick={() => {
                        // drop the act, their songs, and their slot in the billing
                        const artists = (c.artists ?? []).filter((x) => x.name !== a.name);
                        const songArtists = { ...(c.songArtists ?? {}) };
                        const setlist = c.setlist.filter((song) => {
                          const who = songArtists[song];
                          if (who && who.toLowerCase() === a.name.toLowerCase()) { delete songArtists[song]; return false; }
                          return true;
                        });
                        const names = artists.map((x) => x.name);
                        updateConcert(c.id, {
                          artists,
                          setlist,
                          songArtists,
                          artist: names.length ? (names.length > 4 ? `${names.slice(0, 4).join(" & ")} & more` : names.join(" & ")) : c.artist,
                        });
                        setConcerts(getConcerts());
                      }}
                      aria-label={`Remove ${a.name}`}
                      className="pressable flex h-4 w-4 items-center justify-center rounded-full bg-card2 text-[10px] text-sub"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {editingLineup && (
                <button
                  onClick={async () => {
                    const name = prompt("Who else performed that night?");
                    if (!name?.trim()) return;
                    const list = c.artists ?? splitArtists(c.artist).map((n) => ({ name: n, imageUrl: null }));
                    let imageUrl: string | null = null;
                    try {
                      const r = await fetch(`/api/artist?name=${encodeURIComponent(name.trim())}`);
                      imageUrl = (await r.json()).artist?.imageUrl ?? null;
                    } catch {}
                    const artists = [...list, { name: name.trim(), imageUrl }];
                    const names = artists.map((x) => x.name);
                    updateConcert(c.id, {
                      artists,
                      artist: names.length > 4 ? `${names.slice(0, 4).join(" & ")} & more` : names.join(" & "),
                      creditsChecked: false,
                    });
                    setConcerts(getConcerts());
                  }}
                  className="pressable rounded-full bg-card2 px-3 py-1.5 text-xs text-accent"
                >
                  ＋ Add artist
                </button>
              )}
            </div>
          </Section>
        )}

        <Section
          label="SETLIST"
          action={
            c.setlist.length > 0 ? (
              <button
                onClick={() => setEditingSetlist((v) => !v)}
                className="pressable text-[11px] text-accent"
              >
                {editingSetlist ? "Done" : "Edit"}
              </button>
            ) : null
          }
        >
          {c.info && (
            <p className="mb-2 text-xs italic text-sub">⚠ {c.info}</p>
          )}
          {(c.setlistFromWiki || c.wikiSourced) && c.setlist.length > 0 && (
            <p className="mb-2 text-[11px] text-sub">
              From Wikipedia — representative of the tour, not verified for this night.
            </p>
          )}
          {c.setlist.length === 0 && (
            <p className="font-mono text-xs text-sub">
              Setlist not available yet — fans haven&apos;t logged it on setlist.fm.
              Check back in a few days.
            </p>
          )}
          <ol className="flex flex-col gap-1">
            {c.setlist.map((s, i) => c.cancelled ? (
              <li key={s} className="flex items-baseline gap-3 py-1 text-sm text-sub">
                <span className="w-4 text-right font-mono text-[11px]">{i + 1}.</span>
                {s}
              </li>
            ) : (
              <li key={s}>
                <button
                  onClick={() => toggleSong(s, c.songArtists?.[s] ?? splitArtists(c.artist)[0] ?? c.artist)}
                  className="pressable flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] ${songStatus[s] ? "text-sub" : "text-accent"}`}>
                    {loadingSong === s ? "…" : playingSong === s ? "❚❚" : songStatus[s] ? "—" : "▶"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${playingSong === s ? "font-semibold text-accent" : ""} ${songStatus[s] ? "text-sub" : ""}`}>{s}</span>
                  {editingSetlist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const setlist = c.setlist.filter((x, xi) => !(x === s && xi === i));
                        const songArtists = { ...(c.songArtists ?? {}) };
                        delete songArtists[s];
                        updateConcert(c.id, { setlist, songArtists });
                        setConcerts(getConcerts());
                      }}
                      aria-label={`Remove ${s}`}
                      className="pressable flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card2 text-xs text-sub"
                    >
                      ✕
                    </button>
                  )}
                  {(() => {
                    // who played this song — a joint credit shows both faces
                    const credit = c.songArtists?.[s] ?? splitArtists(c.artist)[0] ?? c.artist;
                    const names = splitArtists(credit).slice(0, 3);
                    if (!names.length) return null;
                    const shown = names.slice(0, 2);
                    const extra = names.length - shown.length;
                    return (
                      <span className="ml-1 flex shrink-0 items-center">
                        {shown.map((name, idx) => {
                          const who = c.artists?.find((a) => a.name.toLowerCase() === name.toLowerCase());
                          return (
                            <span
                              key={`${name}-${idx}`}
                              title={name}
                              style={{ marginLeft: idx === 0 ? 0 : -9, zIndex: shown.length - idx }}
                              className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-bg bg-card2 text-[9px] font-bold text-sub"
                            >
                              {who?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={who.imageUrl} alt={name} className="h-full w-full object-cover" />
                              ) : (
                                name.replace(/[^A-Za-z ]/g, "").slice(0, 2).toUpperCase()
                              )}
                            </span>
                          );
                        })}
                        {extra > 0 && (
                          <span className="ml-[-9px] flex h-6 w-6 items-center justify-center rounded-full border border-bg bg-card2 text-[9px] font-bold text-accent">
                            +{extra}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {songCover[s] && (
                    <span className="max-w-[110px] shrink-0 truncate rounded-full bg-card px-2 py-0.5 text-[10px] text-sub">♫ {songCover[s]}</span>
                  )}
                  {songStatus[s] === "unreleased" && (
                    <a
                      href={`https://soundcloud.com/search?q=${encodeURIComponent(`${c.artist} ${s}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-accent/80"
                    >
                      UNRELEASED? SC ▸
                    </a>
                  )}
                  {songStatus[s] === "no_preview" && (
                    <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] text-sub">released · no preview</span>
                  )}
                  {playingSong === s && (
                    <span className="flex items-end gap-0.5" aria-hidden>
                      {[0, 1, 2].map((k) => (
                        <span key={k} className="w-1 rounded-sm bg-accent" style={{ animation: `eq 0.8s ease-in-out ${k * 0.15}s infinite alternate`, height: 10 }} />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 font-mono text-[10px] text-sub">Setlist via setlist.fm · Previews via iTunes</div>
        </Section>

        <Section label={`MEMORIES (${(c.media?.length ?? 0) + (c.photosData?.length ?? 0)})`}>
          <div className="flex flex-wrap justify-center gap-3 py-2">
            {(c.media ?? []).map((m, i) =>
              m.type === "video" ? (
                mediaUrls[m.id] ? (
                  <div key={m.id} className="relative">
                    <video
                      src={mediaUrls[m.id]}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-[220px] max-w-full rounded-xl bg-card"
                    />
                    <button
                      onClick={() => removeMedia(m.id)}
                      aria-label="Delete video"
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card2 text-xs text-sub"
                    >
                      ✕
                    </button>
                  </div>
                ) : null
              ) : (
                <div
                  key={m.id}
                  className="relative w-[104px] border border-hairline bg-white p-1.5 pb-5 shadow-[0_3px_8px_rgb(30_30_30/0.2)]"
                  style={{ transform: `rotate(${[-4, 2, -2, 3, -1, 4][i % 6]}deg)` }}
                >
                  {mediaUrls[m.id] ? (
                    <button onClick={() => setLightbox(mediaUrls[m.id])} className="block w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrls[m.id]} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ) : (
                    <div className="aspect-square w-full bg-card" />
                  )}
                  <button
                    onClick={() => removeMedia(m.id)}
                    aria-label="Delete photo"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card2 text-xs text-sub"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
            {(c.photosData ?? []).map((src, i) => (
              <div
                key={`legacy-${i}`}
                className="relative w-[104px] border border-hairline bg-white p-1.5 pb-5 shadow-[0_3px_8px_rgb(30_30_30/0.2)]"
                style={{ transform: `rotate(${[-4, 2, -2, 3, -1, 4][i % 6]}deg)` }}
              >
                <button onClick={() => setLightbox(src)} className="block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </button>
                <button
                  onClick={() => removeLegacyPhoto(i)}
                  aria-label="Delete photo"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card2 text-xs text-sub"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <button onClick={() => fileRef.current?.click()} className="pressable rounded-full border border-hairline bg-card px-4 py-2 font-mono text-xs">
              + ADD PHOTOS / VIDEOS
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPickPhotos} />
          </div>
        </Section>

        <Section label="JOURNAL">
          <textarea
            value={c.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="What do you remember about this night?"
            rows={3}
            className="w-full resize-none rounded-md border border-hairline bg-card p-3 text-sm italic text-ink outline-none placeholder:text-sub/60"
          />
        </Section>

        <Section label="FOOTAGE">
          {footage.length > 0 && (
            <div className="-mx-2 mb-3 flex snap-x gap-3 overflow-x-auto px-2 pb-2">
              {footage.map((v) => (
                <div key={v.videoId} className="w-[240px] shrink-0 snap-start overflow-hidden rounded-xl bg-card">
                  {playing === v.videoId ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&playsinline=1`}
                      className="aspect-video w-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      title={v.title}
                    />
                  ) : (
                    <button onClick={() => setPlaying(v.videoId)} className="pressable relative block w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 pl-1 text-lg text-accent">▶</span>
                      </span>
                    </button>
                  )}
                  <p className="truncate px-2.5 py-2 text-xs">{v.title}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mb-2 text-xs text-sub">
            {footage.length > 0 ? "More from everyone who was there:" : "Watch everyone's videos from this night:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ["TikTok", `https://www.tiktok.com/search?q=${encodeURIComponent(`${c.artist} ${c.venue} ${c.dateDisplay}`)}`],
              ["Instagram", `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${c.artist} ${c.city} ${c.year}`)}`],
              ["X", `https://x.com/search?q=${encodeURIComponent(`${c.artist} ${c.venue}`)}&f=video`],
              ["YouTube", `https://www.youtube.com/results?search_query=${encodeURIComponent(`${c.artist} ${c.venue} ${c.dateDisplay}`)}`],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable rounded-full bg-card px-4 py-2 text-xs"
              >
                {label} ▸
              </a>
            ))}
          </div>
        </Section>

        <div className="flex justify-center px-6 pt-5">
          <button
            onClick={() => downloadShareCard(c)}
            className="pressable rounded-full border border-hairline bg-card px-6 py-2.5 font-mono text-xs tracking-[0.15em]"
          >
            ⤓ SHARE CARD
          </button>
        </div>
        <div className="flex justify-center px-6 pt-3">
          <button onClick={del} className="font-mono text-[11px] tracking-[0.15em] text-sub underline underline-offset-4">
            EJECT MEMORY (DELETE)
          </button>
        </div>
      </section>
    </AppShell>
  );
}


function compressBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Legacy: dataURL compressor (old photos still render from localStorage). */
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s);
      cv.height = Math.round(img.height * s);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/jpeg", 0.72));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
