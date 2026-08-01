"use client";

import { useEffect, useState } from "react";

/** Number counts up on mount — the little dopamine hit. */
export function LcdStat({ label, value }: { label: string; value: string | number }) {
  const str = String(value);
  const m = str.match(/^([^0-9]*)([0-9,]+)(.*)$/);
  const target = m ? Number(m[2].replace(/,/g, "")) : null;
  const [n, setN] = useState(0);

  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(target); return; }
    let raf: number;
    const t0 = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // Only group digits if the source did (or it's a genuinely big count) —
  // years like 2026 must never become "2,026".
  const grouped = m ? m[2].includes(",") || (target ?? 0) >= 10000 : false;
  const display = target === null ? str : `${m![1]}${grouped ? n.toLocaleString() : String(n)}${m![3]}`;
  const size = display.length > 10 ? 17 : display.length > 7 ? 21 : 26;

  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
      <span className="font-display font-bold leading-tight text-accent" style={{ fontSize: size }}>{display}</span>
      <span className="text-xs font-medium text-sub">{label}</span>
    </div>
  );
}
