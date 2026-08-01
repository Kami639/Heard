"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { fetchProfile, addFriend, overlap, type PublicProfile } from "@/lib/social";

export default function PublicArchive({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile(code)
      .then((p) => { setProfile(p); setState(p ? "ready" : "missing"); })
      .catch(() => setState("missing"));
  }, [code]);

  if (state === "loading") {
    return <AppShell title="archive"><p className="pt-16 text-center text-sm text-sub">Loading…</p></AppShell>;
  }
  if (!profile) {
    return (
      <AppShell title="archive">
        <p className="px-8 pt-16 text-center text-sm text-sub">
          No archive found for that code — it may have been unpublished.
        </p>
      </AppShell>
    );
  }

  const { sameShows, sharedArtists } = overlap(profile);
  const byYear = profile.concerts.reduce<Record<number, typeof profile.concerts>>((acc, c) => {
    (acc[c.year] ??= []).push(c);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <AppShell title={profile.name}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-2">
        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Shows" value={profile.shows} />
          <LcdStat label="Songs" value={profile.songs} />
          <LcdStat label="Cities" value={profile.cities.length} />
        </div>

        {(sameShows.length > 0 || sharedArtists.length > 0) && (
          <div className="rounded-2xl bg-card p-4">
            <p className="text-[13px] font-semibold text-accent">You two overlap</p>
            {sameShows.length > 0 && (
              <p className="pt-1 text-xs text-sub">
                Both at {sameShows.length} {sameShows.length === 1 ? "show" : "shows"} — {sameShows.slice(0, 3).map((c) => c.artist).join(", ")}
              </p>
            )}
            {sharedArtists.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {sharedArtists.slice(0, 12).map((a) => (
                  <span key={a} className="rounded-full bg-card2 px-2.5 py-1 text-[11px]">{a}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { addFriend(profile.code, profile.name); setSaved(true); }}
          disabled={saved}
          className="pressable rounded-xl bg-accent py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {saved ? "Saved to your friends ✓" : "＋ Save to my friends"}
        </button>

        {years.map((y) => (
          <div key={y}>
            <h2 className="pb-2 pl-1 font-display text-lg font-bold">{y}</h2>
            <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {byYear[y].map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/artist/${encodeURIComponent(c.artist.split(" & ")[0])}`)}
                  className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.artist}</span>
                    <span className="block truncate text-xs text-sub">{c.venue} · {c.city} · {c.dateDisplay}</span>
                  </span>
                  <span className="shrink-0 tracking-[2px] text-accent">{"★".repeat(c.rating)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
