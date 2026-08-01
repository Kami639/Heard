"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { claimPlayback, isCurrent, playUrl, stopAudio } from "@/lib/audio";
import { getConcerts } from "@/lib/store";
import { splitArtists } from "@/features/concerts/data";
import { needsCredits, fixAllCredits } from "@/lib/credits";
import { useRef } from "react";

interface SongCount { song: string; artist: string; count: number }

export default function Songs() {
  const router = useRouter();
  const [songs, setSongs] = useState<SongCount[]>([]);
  const [total, setTotal] = useState(0);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [fixing, setFixing] = useState<string | null>(null);
  const [songStatus, setSongStatus] = useState<Record<string, "unreleased" | "no_preview">>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Record<string, string | null>>({});

  async function toggle(song: string, artist: string) {
    const key = `${song}::${artist}`;
    if (playingKey === key) { audioRef.current?.pause(); audioRef.current = null; setPlayingKey(null); return; }
    audioRef.current?.pause(); audioRef.current = null; setPlayingKey(null);
    setLoadingKey(key);
    let url = cache.current[key];
    if (url === undefined) {
      try {
        const r = await fetch(`/api/preview?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}`);
        const data = await r.json();
        url = data.previewUrl ?? null;
        if (!url) setSongStatus((m) => ({ ...m, [key]: data.status === "not_found" ? "unreleased" : "no_preview" }));
      } catch { url = null; }
      if (url) cache.current[key] = url; // failures retry next tap
    }
    setLoadingKey(null);
    if (!url) return;
    const audio = new Audio(url);
    audio.onended = () => setPlayingKey(null);
    audioRef.current = audio;
    setPlayingKey(key);
    audio.play().catch(() => setPlayingKey(null));
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  useEffect(() => {
    const load = () => {
    const concerts = getConcerts();
    const map = new Map<string, SongCount>();
    let t = 0;
    for (const c of concerts) {
      if (c.cancelled) continue;
      for (const s of c.setlist) {
        t++;
        // whoever actually performed it — not the whole night's billing
        const performer = c.songArtists?.[s] ?? splitArtists(c.artist)[0] ?? c.artist;
        const key = `${s.toLowerCase()}::${performer.toLowerCase()}`;
        const cur = map.get(key);
        if (cur) cur.count++;
        else map.set(key, { song: s, artist: performer, count: 1 });
      }
    }
    setSongs([...map.values()].sort((a, b) => b.count - a.count));
    setTotal(t);
    };
    load();
    setPending(needsCredits(getConcerts()).length);
    window.addEventListener("heard-sync", load);
    return () => window.removeEventListener("heard-sync", load);
  }, []);

  return (
    <AppShell title="songs" count={total}>
      <section className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 pb-4 pt-4">
        <h1 className="text-center font-display text-[13px] font-extrabold tracking-[0.3em] text-sub">SONGS HEARD</h1>
        <p className="pb-2 text-center font-mono text-xs text-sub">{total} songs live · {songs.length} unique</p>
        {songs.length === 0 && (
          <p className="pt-8 text-center font-mono text-xs text-sub">
            Nothing heard yet.<br />Add a concert with a setlist.
          </p>
        )}
        {songs.map((s, i) => {
          const key = `${s.song}::${s.artist}`;
          return (
            <button
              key={key}
              onClick={() => toggle(s.song, s.artist)}
              className="pressable flex w-full items-center gap-3 border-b border-hairline/50 py-1.5 text-left"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] ${songStatus[key] ? "text-sub" : "text-accent"}`}>
                {loadingKey === key ? "…" : playingKey === key ? "❚❚" : songStatus[key] ? "—" : "▶"}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm ${playingKey === key ? "font-semibold text-accent" : ""}`}>{s.song}</div>
                <div className="truncate font-mono text-[10px] text-sub">{s.artist}</div>
              </div>
              {songStatus[key] === "unreleased" && (
                <a
                  href={`https://soundcloud.com/search?q=${encodeURIComponent(`${s.artist} ${s.song}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-accent/80"
                >
                  UNRELEASED? SC ▸
                </a>
              )}
              <span className="shrink-0 font-mono text-xs text-sub">×{s.count}</span>
            </button>
          );
        })}
      </section>
    </AppShell>
  );
}
