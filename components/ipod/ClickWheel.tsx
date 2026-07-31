"use client";

import { click } from "@/lib/sound";

interface Props {
  onMenu?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onCenter?: () => void;
  centerLabel?: string;
}

/** The signature element: an iPod-style click wheel used for navigation. */
export function ClickWheel({ onMenu, onPrev, onNext, onCenter, centerLabel = "OPEN" }: Props) {
  const label =
    "absolute font-mono text-[11px] tracking-[0.12em] text-sub p-2 active:translate-y-px";
  return (
    <div className="flex justify-center py-4">
      <div className="relative h-[190px] w-[190px] rounded-full border border-hairline wheel-face bg-card shadow-[0_4px_10px_rgb(30_30_30/0.18),inset_0_1px_0_rgb(255_255_255/0.7)]">
        <button className={`${label} left-1/2 top-1 -translate-x-1/2`} onClick={() => { click(); onMenu?.(); }}>MENU</button>
        <button className={`${label} left-2 top-1/2 -translate-y-1/2`} onClick={() => { click(); onPrev?.(); }}>◀︎</button>
        <button className={`${label} right-2 top-1/2 -translate-y-1/2`} onClick={() => { click(); onNext?.(); }}>▶︎</button>
        <span className={`${label} bottom-1 left-1/2 -translate-x-1/2`}>▶︎❙❙</span>
        <button
          onClick={() => { click(); onCenter?.(); }}
          className="absolute left-1/2 top-1/2 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline wheel-center bg-paper font-mono text-[10px] tracking-[0.12em] text-sub shadow-[inset_0_2px_4px_rgb(30_30_30/0.15)] active:scale-95 transition-transform"
        >
          {centerLabel}
        </button>
      </div>
    </div>
  );
}
