"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* First-run onboarding. One job: get the first memories logged.
 * Backfilling the archive is the behavior that makes people stay —
 * an empty archive has nothing to come back to. */

const KEY = "heard.onboarded.v1";

const SLIDES = [
  {
    icon: "🎟️",
    title: "Every show you've ever seen,\nin one place",
    body: "Setlists, photos, ticket prices, who got brought out — heard remembers the nights your camera roll forgot.",
  },
  {
    icon: "⏪",
    title: "Start with the past",
    body: "The magic is the backfill. Add the shows you've ALREADY been to — even ones from years ago. Setlists autofill from setlist.fm; you just remember being there.",
  },
  {
    icon: "🏆",
    title: "Then watch it add up",
    body: "Wrapped, badges, your map, your top-ranked nights — everything is built from what you log. The more you backfill, the better it gets.",
  },
];

export function Onboarding({ concertCount }: { concertCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      if (concertCount === 0 && !localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, [concertCount]);

  function done(toAdd: boolean) {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
    if (toAdd) router.push("/add");
  }

  if (!open) return null;
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm lg:items-center" role="dialog" aria-modal="true" aria-label="Welcome to heard">
      <div className="fade-up w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:rounded-3xl">
        <div className="flex justify-center gap-1.5 pb-5" aria-hidden>
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-accent" : "w-1.5 bg-card2"}`} />
          ))}
        </div>
        <div key={slide} className="fade-up flex flex-col items-center gap-3 text-center">
          <span className="text-5xl" aria-hidden>{s.icon}</span>
          <h2 className="name-xl whitespace-pre-line font-display text-2xl">{s.title}</h2>
          <p className="text-sm leading-relaxed text-sub">{s.body}</p>
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <button
            onClick={() => (last ? done(true) : setSlide(slide + 1))}
            className="pressable rounded-full bg-accent py-3 font-semibold text-black"
          >
            {last ? "Add my first show" : "Next"}
          </button>
          <button onClick={() => done(false)} className="pressable py-2 text-xs text-sub">
            {last ? "Maybe later" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Gentle nudge until the archive has some depth. */
export function BackfillNudge({ concertCount }: { concertCount: number }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem("heard.nudge.hide") === "1"); } catch {}
  }, []);
  if (hidden || concertCount === 0 || concertCount >= 5) return null;
  return (
    <div className="fade-up flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/10 p-3.5">
      <span className="text-xl" aria-hidden>⏪</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">Keep backfilling</p>
        <p className="text-xs text-sub">
          {concertCount} {concertCount === 1 ? "memory" : "memories"} so far — add the older shows too.
          Wrapped and badges get better with every one.
        </p>
      </div>
      <button
        onClick={() => router.push("/add")}
        className="pressable shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-black"
      >
        Add
      </button>
      <button
        onClick={() => { setHidden(true); try { localStorage.setItem("heard.nudge.hide", "1"); } catch {} }}
        aria-label="Dismiss backfill reminder"
        className="pressable shrink-0 p-2 text-sub"
      >
        ✕
      </button>
    </div>
  );
}
