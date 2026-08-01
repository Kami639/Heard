"use client";

// One player for the whole app. Every page routes playback through here, so
// two songs can never overlap — including across page navigations.

let current: HTMLAudioElement | null = null;
let generation = 0;

/** Claim the player. Returns a token; if a newer tap happens while your
 *  preview URL is still loading, your token goes stale and won't play. */
export function claimPlayback(): number {
  stopAudio();
  return ++generation;
}

export function isCurrent(token: number): boolean {
  return token === generation;
}

export function playUrl(url: string, token: number, onEnd?: () => void): boolean {
  if (!isCurrent(token)) return false; // a newer tap won
  stopAudio();
  const el = new Audio(url);
  current = el;
  el.onended = () => { if (current === el) current = null; onEnd?.(); };
  el.play().catch(() => {});
  return true;
}

export function stopAudio() {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
}
