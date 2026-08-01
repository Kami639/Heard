"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts } from "@/lib/store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

interface FriendData { name?: string; concerts: Partial<ConcertRec>[] }

export default function Compare() {
  const [mine, setMine] = useState<ConcertRec[]>([]);
  const [friend, setFriend] = useState<FriendData | null>(null);

  useEffect(() => {
    setMine(getConcerts().filter((c) => !c.cancelled));
    try {
      const raw = sessionStorage.getItem("heard.compare");
      if (raw) setFriend(JSON.parse(raw));
    } catch {}
  }, []);

  if (!friend) {
    return (
      <AppShell title="compare">
        <p className="px-8 pt-16 text-center text-sm text-sub">
          Import a friend&apos;s archive file from your Profile page to compare.
        </p>
      </AppShell>
    );
  }

  const theirs = (friend.concerts ?? []).filter((c) => !c.cancelled);
  const myArtists = new Set(mine.flatMap((c) => splitArtists(c.artist).map(norm)));
  const theirArtists = new Set(theirs.flatMap((c) => splitArtists(c.artist ?? "").map(norm)));
  const sharedArtists = [...new Set(mine.flatMap((c) => splitArtists(c.artist)))]
    .filter((a) => theirArtists.has(norm(a)));

  const showKey = (c: Partial<ConcertRec>) => `${norm(c.artist ?? "")}::${c.dateDisplay ?? ""}`;
  const theirShowKeys = new Set(theirs.map(showKey));
  const sameShows = mine.filter((c) => theirShowKeys.has(showKey(c)));

  return (
    <AppShell title="compare">
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 text-center">
            <p className="text-xs text-sub">You</p>
            <p className="font-display text-3xl font-bold text-accent">{mine.length}</p>
            <p className="text-xs text-sub">shows</p>
          </div>
          <div className="rounded-2xl bg-card p-3 text-center">
            <p className="truncate text-xs text-sub">{friend.name ?? "Friend"}</p>
            <p className="font-display text-3xl font-bold text-accent">{theirs.length}</p>
            <p className="text-xs text-sub">shows</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LcdStat label="Same shows" value={sameShows.length} />
          <LcdStat label="Shared artists" value={sharedArtists.length} />
        </div>

        {sameShows.length > 0 && (
          <div>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">YOU WERE BOTH THERE 🫂</h2>
            <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {sameShows.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <p className="text-sm font-semibold">{c.artist}</p>
                  <p className="text-xs text-sub">{c.venue} · {c.dateDisplay}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {sharedArtists.length > 0 && (
          <div>
            <h2 className="pb-2 pl-1 text-sm font-semibold text-sub">ARTISTS YOU&apos;VE BOTH SEEN</h2>
            <div className="flex flex-wrap gap-2">
              {sharedArtists.map((a) => (
                <span key={a} className="rounded-full bg-card px-3 py-1.5 text-xs">{a}</span>
              ))}
            </div>
          </div>
        )}

        {sameShows.length === 0 && sharedArtists.length === 0 && (
          <p className="pt-8 text-center text-sm text-sub">No overlap yet — somebody&apos;s got homework.</p>
        )}
      </section>
    </AppShell>
  );
}
