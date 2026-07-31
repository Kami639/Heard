"use client";

import type { Concert } from "@/features/concerts/types";

/** Archive rows render as stacked cassette tapes, not a boring list. */
export function CassetteCard({ concert, onOpen }: { concert: Concert; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="pressable w-full rounded-md border border-hairline bg-card px-4 py-2 text-left"
    >
      <div className="flex items-center justify-between font-mono text-[10px] text-sub">
        <span>━━━━</span>
        <span>{concert.date.slice(0, 4)}</span>
        <span>━━━━</span>
      </div>
      <div className="flex items-center gap-3 py-1">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold uppercase tracking-wide">
            {concert.artist}
          </div>
          <div className="truncate text-xs text-sub">{concert.tour}</div>
          <div className="font-mono text-[11px] text-sub">
            {concert.city} · {"★".repeat(concert.rating ?? 0)}
          </div>
        </div>
        <div className="flex gap-2" aria-hidden>
          <div className="h-4 w-4 rounded-full border-2 border-hairline bg-paper" />
          <div className="h-4 w-4 rounded-full border-2 border-hairline bg-paper" />
        </div>
      </div>
    </button>
  );
}
