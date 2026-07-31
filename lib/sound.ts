"use client";

let ctx: AudioContext | null = null;

/** Tiny mechanical wheel click. Soft, never annoying. */
export function click() {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1400;
    g.gain.setValueAtTime(0.018, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  } catch {}
}
