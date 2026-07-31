"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Art, Stars } from "@/components/Art";
import { getConcerts, updateConcert, deleteConcert } from "@/lib/store";
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

  const idx = concerts.findIndex((c) => c.id === id);
  const c = concerts[idx];

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!c) return;
    const files = [...(e.target.files ?? [])].slice(0, 6);
    const imgs: string[] = [];
    for (const f of files) imgs.push(await compress(f));
    const photosData = [...(c.photosData ?? []), ...imgs].slice(0, 12);
    try {
      updateConcert(c.id, { photosData, photos: photosData.length });
      setConcerts(getConcerts());
    } catch {
      alert("Storage full — remove some photos or use smaller ones.");
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
              <li key={s} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 text-right font-mono text-[11px] text-sub">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-2 font-mono text-[10px] text-sub">Setlist via setlist.fm</div>
        </Section>

        <Section label={`PHOTOS (${c.photosData?.length ?? 0})`}>
          <div className="flex flex-wrap justify-center gap-3 py-2">
            {(c.photosData ?? []).map((src, i) => (
              <div
                key={i}
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
              + ADD PHOTOS
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
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
          <p className="mb-2 font-mono text-[11px] text-sub">
            Watch everyone&apos;s videos from this night:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ["TikTok", `https://www.tiktok.com/search?q=${encodeURIComponent(`${c.artist} ${c.venue} ${c.dateDisplay}`)}`],
              ["Instagram", `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${c.artist} ${c.city} ${c.year}`)}`],
              ["YouTube", `https://www.youtube.com/results?search_query=${encodeURIComponent(`${c.artist} ${c.venue} ${c.dateDisplay}`)}`],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable rounded-full border border-hairline bg-card px-4 py-2 font-mono text-xs"
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


/** Downscale + JPEG-compress so photos fit in localStorage (~5MB total). */
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
