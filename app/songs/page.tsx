"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getConcerts } from "@/lib/store";

interface SongCount { song: string; artist: string; count: number }

export default function Songs() {
  const router = useRouter();
  const [songs, setSongs] = useState<SongCount[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const concerts = getConcerts();
    const map = new Map<string, SongCount>();
    let t = 0;
    for (const c of concerts) {
      for (const s of c.setlist) {
        t++;
        const key = `${s}::${c.artist}`;
        const cur = map.get(key);
        if (cur) cur.count++;
        else map.set(key, { song: s, artist: c.artist, count: 1 });
      }
    }
    setSongs([...map.values()].sort((a, b) => b.count - a.count));
    setTotal(t);
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
        {songs.map((s, i) => (
          <div key={s.song + s.artist} className="flex items-baseline gap-3 border-b border-hairline/50 py-1.5">
            <span className="w-6 shrink-0 text-right font-mono text-[11px] text-sub">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{s.song}</div>
              <div className="truncate font-mono text-[10px] text-sub">{s.artist}</div>
            </div>
            <span className="shrink-0 font-mono text-xs text-sub">×{s.count}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
