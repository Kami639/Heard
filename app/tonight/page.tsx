"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";

/* ═══ TONIGHT — concert mode ═══
 * Tools for when you're IN the building: a scrolling LED sign for catching
 * an artist's eye, and a glow screen for the slow songs. Screen stays awake
 * while either is up. */

const COLORS = ["#ff9f0a", "#ffffff", "#ff2d55", "#30d158", "#0a84ff", "#bf5af2"];

export default function Tonight() {
  const [sign, setSign] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [mode, setMode] = useState<"idle" | "sign" | "glow">("idle");
  const [glowCycle, setGlowCycle] = useState(false);
  const wakeRef = useRef<any>(null);

  // keep the screen on while performing
  useEffect(() => {
    let cancelled = false;
    async function lock() {
      try {
        if (mode !== "idle" && "wakeLock" in navigator) {
          wakeRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    }
    if (mode !== "idle") lock();
    const revive = () => { if (!cancelled && mode !== "idle" && document.visibilityState === "visible") lock(); };
    document.addEventListener("visibilitychange", revive);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", revive);
      wakeRef.current?.release?.().catch(() => {});
      wakeRef.current = null;
    };
  }, [mode]);

  // glow color cycling
  const [glowColor, setGlowColor] = useState(COLORS[0]);
  useEffect(() => {
    if (mode !== "glow" || !glowCycle) { setGlowColor(color); return; }
    let i = COLORS.indexOf(color);
    const t = setInterval(() => { i = (i + 1) % COLORS.length; setGlowColor(COLORS[i]); }, 1800);
    return () => clearInterval(t);
  }, [mode, glowCycle, color]);

  const duration = { slow: "14s", normal: "9s", fast: "5.5s" }[speed];

  /* ── fullscreen takeovers ─────────────────────────────────────────── */
  if (mode === "sign") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center overflow-hidden bg-black"
        onClick={() => setMode("idle")}
        role="button" aria-label="Tap to exit the sign"
      >
        <div
          className="led-marquee whitespace-nowrap font-display font-extrabold"
          style={{
            color, fontSize: "38vh", lineHeight: 1,
            textShadow: `0 0 30px ${color}, 0 0 90px ${color}66`,
            animationDuration: duration,
          }}
        >
          {sign.toUpperCase()}&nbsp;&nbsp;&nbsp;&nbsp;{sign.toUpperCase()}&nbsp;&nbsp;&nbsp;&nbsp;
        </div>
        <style>{`
          .led-marquee { animation: ledscroll linear infinite; will-change: transform; }
          @keyframes ledscroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @media (prefers-reduced-motion: reduce) { .led-marquee { animation: none; } }
        `}</style>
      </div>
    );
  }

  if (mode === "glow") {
    return (
      <div
        className="fixed inset-0 z-50 transition-colors duration-1000"
        style={{ backgroundColor: glowColor }}
        onClick={() => setMode("idle")}
        role="button" aria-label="Tap to exit the glow"
      />
    );
  }

  /* ── setup ─────────────────────────────────────────────────────────── */
  return (
    <AppShell title="tonight">
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <p className="text-xs text-sub">
          For when you&apos;re in the building. Crank your brightness, then hold your phone high.
        </p>

        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <p className="text-[11px] font-semibold tracking-wide text-accent">LED SIGN</p>
          <input
            value={sign}
            onChange={(e) => setSign(e.target.value.slice(0, 40))}
            placeholder={'e.g. "PLAY THE DEEP CUTS" or "SONG REQUEST INSIDE"'}
            aria-label="Sign text"
            className="w-full rounded-lg bg-card2 px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-sub"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2" role="radiogroup" aria-label="Sign color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  role="radio" aria-checked={color === c} aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-card" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              {(["slow", "normal", "fast"] as const).map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpeed(sp)}
                  className={`pressable rounded-full px-2.5 py-1 font-mono text-[10px] ${
                    speed === sp ? "bg-accent font-semibold text-black" : "bg-card2 text-sub"
                  }`}
                >
                  {sp.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => sign.trim() && setMode("sign")}
            disabled={!sign.trim()}
            className="pressable rounded-xl bg-accent py-3 font-display text-lg font-extrabold text-black disabled:opacity-40"
          >
            LIGHT IT UP
          </button>
          {sign.trim() && (
            <div className="overflow-hidden rounded-lg bg-black py-2">
              <p
                className="truncate text-center font-display text-2xl font-extrabold"
                style={{ color, textShadow: `0 0 12px ${color}` }}
              >
                {sign.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <p className="text-[11px] font-semibold tracking-wide text-accent">GLOW STICK</p>
          <p className="text-xs text-sub">Full-screen color for the ballads. Tap anywhere to come back.</p>
          <label className="flex items-center justify-between text-sm">
            <span>Cycle colors slowly</span>
            <input type="checkbox" checked={glowCycle} onChange={(e) => setGlowCycle(e.target.checked)} className="h-5 w-5 accent-[#ff9f0a]" />
          </label>
          <button
            onClick={() => setMode("glow")}
            className="pressable rounded-xl py-3 font-display text-lg font-extrabold text-black"
            style={{ backgroundColor: color }}
          >
            GLOW
          </button>
        </div>

        <p className="text-center text-[10px] text-sub">
          The screen stays awake while a sign or glow is up.
        </p>
      </section>
    </AppShell>
  );
}
