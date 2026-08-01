"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { getConcerts, updateConcert, deleteConcert, daysUntil } from "@/lib/store";
import { saveMedia, getMedia, deleteMedia } from "@/lib/media";
import { downloadShareCard } from "@/lib/shareCard";
import { useRef } from "react";
import type { ConcertRec } from "@/features/concerts/data";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 pt-4">
      <div className="mb-1.5 border-t border-hairline pt-2 font-mono text-[11px] tracking-[0.2em] text-sub">{label}</div>
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
    let url = previewCache.current[song];
    if (url === undefined) {
      try {
        const r = await fetch(`/api/preview?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}`);
        url = (await r.json()).previewUrl ?? null;
      } catch { url = null; }
      previewCache.current[song] = url;
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
      const t = setTimeout(() => setToast(false), 2000);
      return () => clearTimeout(t);
    }
  }, []);
  useEffect(() => setConcerts(getConcerts()), []);

  const fileRef = useRef<HTMLInputElement>(null);

  const cRef = concerts.find((x) => x.id === id);
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
        const blob = await getMedia(m.id);
        if (blob) { urls[m.id] = URL.createObjectURL(blob); revoked.push(urls[m.id]); }
      }
      setMediaUrls(urls);
    })();
    return () => revoked.forEach((u) => URL.revokeObjectURL(u));
  }, [cForMedia?.media?.length, id]);

  const idx = concerts.findIndex((c) => c.id === id);
  const c = concerts[idx];

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!c) return;
    const files = [...(e.target.files ?? [])].slice(0, 6);
    const added: { id: string; type: "image" | "video" }[] = [];
    for (const f of files) {
      try {
        if (f.type.startsWith("video/")) {
          if (f.size > 60 * 1024 * 1024) { alert(`${f.name} is over 60MB — trim it shorter.`); continue; }
          added.push({ id: await saveMedia(f), type: "video" });
        } else if (f.type.startsWith("image/")) {
          added.push({ id: await saveMedia(await compressBlob(f)), type: "image" });
        }
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
      deleteConcert(c.id);
      router.push("/archive");
    }
  };

  if (!c) return null;

  return (
    <AppShell count={concerts.length}>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center lg:absolute lg:bottom-8">
          <div className="animate-[toastIn_0.3s_ease-out] rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-accent/30">
            ✓ Memory saved
          </div>
        </div>
      )}
      <section className="flex-1 overflow-y-auto pb-4">
        <div className="flex flex-col items-center gap-3 px-6 pt-4">
          <div className="w-full max-w-64"><Art c1={c.c1} c2={c.c2} initials={c.initials} imageUrl={c.imageUrl} /></div>
          <div className="text-center">
            <div
              className="max-w-full break-words px-2 font-display font-extrabold leading-tight"
              style={{ fontSize: `clamp(19px, ${Math.max(19, 34 - Math.max(0, c.artist.length - 12))}px, 28px)` }}
            >
              {c.artist}
            </div>
            <div className="max-w-full break-words px-2 text-sm text-sub">{c.tour}</div>
            <div className="mt-0.5 font-mono text-xs text-sub">{c.venue} · {c.city}</div>
            <div className="font-mono text-xs text-sub">{c.dateDisplay}</div>
            {daysUntil(c.dateDisplay) !== null && (
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

        <Section label="SETLIST">
          {c.setlist.length === 0 && (
            <p className="font-mono text-xs text-sub">
              Setlist not available yet — fans haven&apos;t logged it on setlist.fm.
              Check back in a few days.
            </p>
          )}
          <ol className="flex flex-col gap-1">
            {c.setlist.map((s, i) => (
              <li key={s}>
                <button
                  onClick={() => toggleSong(s, c.artist)}
                  className="pressable flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] text-accent">
                    {loadingSong === s ? "…" : playingSong === s ? "❚❚" : "▶"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${playingSong === s ? "font-semibold text-accent" : ""}`}>{s}</span>
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
                  <video
                    key={m.id}
                    src={mediaUrls[m.id]}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-[220px] max-w-full rounded-xl bg-card"
                  />
                ) : null
              ) : (
                <div
                  key={m.id}
                  className="w-[104px] border border-hairline bg-white p-1.5 pb-5 shadow-[0_3px_8px_rgb(30_30_30/0.2)]"
                  style={{ transform: `rotate(${[-4, 2, -2, 3, -1, 4][i % 6]}deg)` }}
                >
                  {mediaUrls[m.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrls[m.id]} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-card" />
                  )}
                </div>
              )
            )}
            {(c.photosData ?? []).map((src, i) => (
              <div
                key={`legacy-${i}`}
                className="w-[104px] border border-hairline bg-white p-1.5 pb-5 shadow-[0_3px_8px_rgb(30_30_30/0.2)]"
                style={{ transform: `rotate(${[-4, 2, -2, 3, -1, 4][i % 6]}deg)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full object-cover" />
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
