"use client";

import { useEffect, useState } from "react";
import { pushSupport, enablePush, disablePush, currentSubscription, type PushSupport } from "@/lib/push";
import { scrobbleSettings, saveScrobbleSettings, getPlays } from "@/lib/scrobbles";

/* Two self-contained profile cards, so the (already long) profile page
 * only grows by two lines. */

export function NotifyCard() {
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupport(pushSupport());
    currentSubscription().then((s) => setEnabled(Boolean(s)));
  }, []);

  if (support === "no-server") return null; // VAPID keys not configured

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-[15px] font-semibold">Notifications</p>
      <p className="pt-1 text-xs text-sub">
        A morning nudge on show anniversaries — &ldquo;3 years ago tonight&rdquo; — and a
        reminder the day before a logged show. Nothing else, ever.
      </p>
      {support === "needs-install" ? (
        <p className="mt-3 rounded-lg bg-card2 px-3 py-2.5 text-xs text-sub">
          On iPhone, add heard to your Home Screen first (Share&nbsp;→&nbsp;Add to Home
          Screen), then enable notifications from inside the installed app.
        </p>
      ) : support === "unsupported" ? (
        <p className="mt-3 text-xs text-sub">This browser doesn&apos;t support notifications.</p>
      ) : (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true); setMsg(null);
            if (enabled) { await disablePush(); setEnabled(false); }
            else {
              const err = await enablePush();
              if (err) setMsg(err); else { setEnabled(true); setMsg("You're in. First nudge lands on your next anniversary."); }
            }
            setBusy(false);
          }}
          className={`pressable mt-3 w-full rounded-lg py-2 text-sm font-bold disabled:opacity-50 ${
            enabled ? "bg-card2 text-sub" : "bg-accent text-black"
          }`}
        >
          {busy ? "…" : enabled ? "Turn off notifications" : "Turn on notifications"}
        </button>
      )}
      {msg && <p className="pt-2 text-xs text-sub">{msg}</p>}
    </div>
  );
}

export function ScrobbleCard() {
  const [service, setService] = useState<"listenbrainz" | "lastfm">("listenbrainz");
  const [user, setUser] = useState("");
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = scrobbleSettings();
    if (s) { setService(s.service); setUser(s.user); setLinked(true); }
  }, []);

  async function link() {
    if (!user.trim()) return;
    setBusy(true); setMsg(null);
    saveScrobbleSettings({ service, user: user.trim() });
    const plays = await getPlays(true);
    if (plays) {
      setLinked(true);
      setMsg(`Linked — ${Object.keys(plays).length} artists found. Streams now show on artist pages.`);
      window.dispatchEvent(new Event("heard-sync"));
    } else {
      saveScrobbleSettings(null);
      setMsg("Couldn't find that account — check the username (and, for Last.fm, that the server key is set).");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-[15px] font-semibold">Streaming history</p>
      <p className="pt-1 text-xs text-sub">
        Link your scrobbles and artist pages get a second axis: streamed 400 times, seen twice.
      </p>
      <div className="flex gap-2 pt-3">
        {(["listenbrainz", "lastfm"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setService(s)}
            className={`pressable rounded-full px-3 py-1 text-[11px] ${
              service === s ? "bg-accent font-semibold text-black" : "bg-card2 text-sub"
            }`}
          >
            {s === "listenbrainz" ? "ListenBrainz" : "Last.fm"}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && link()}
          placeholder={`${service === "lastfm" ? "Last.fm" : "ListenBrainz"} username`}
          aria-label="Scrobble service username"
          className="min-w-0 flex-1 rounded-lg bg-card2 px-3 py-2 text-[15px] text-ink outline-none placeholder:text-sub"
        />
        <button
          onClick={link}
          disabled={busy || !user.trim()}
          className="pressable shrink-0 rounded-lg bg-accent px-4 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? "…" : linked ? "Relink" : "Link"}
        </button>
      </div>
      {linked && !msg && (
        <button
          onClick={() => { saveScrobbleSettings(null); setLinked(false); setUser(""); setMsg("Unlinked."); }}
          className="pressable pt-2 text-xs text-sub underline underline-offset-4"
        >
          Unlink
        </button>
      )}
      {msg && <p className="pt-2 text-xs text-sub">{msg}</p>}
    </div>
  );
}
