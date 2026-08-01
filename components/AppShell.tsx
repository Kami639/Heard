"use client";

import { useEffect } from "react";

let healedThisSession = false;

import { StatusBar } from "./StatusBar";
import { TabBar } from "./TabBar";
import { Sidebar } from "./Sidebar";

/**
 * One app, two outfits:
 * - Phone: iOS layout — header, content, bottom tab bar.
 * - Desktop (lg+): macOS window — traffic lights, translucent sidebar,
 *   floating on a dark desktop gradient.
 */
export function AppShell({
  title,
  count,
  children,
}: {
  title?: string;
  count?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Background art healer: quietly repair a few covers that were added
    // while Spotify was rate-limited, so home/archive fill in over time.
    if (!healedThisSession) {
      healedThisSession = true;
      (async () => {
        try {
          const { getConcerts, updateConcert } = await import("@/lib/store");
          const missing = getConcerts().filter(
            (c) => !c.imageUrl && !c.artists?.some((a) => a.imageUrl)
          ).slice(0, 3);
          for (const c of missing) {
            const r = await fetch(
              `/api/artwork?artist=${encodeURIComponent(c.artist)}&tour=${encodeURIComponent(c.tour ?? "")}`
            );
            const url = (await r.json()).imageUrl;
            if (url) updateConcert(c.id, { imageUrl: url });
          }
          window.dispatchEvent(new Event("heard-sync"));
        } catch {}
      })();
    }

    // iOS can evict photos/videos when storage is only "best effort", and the
    // grant resets between sessions — so ask every launch.
    (async () => {
      try {
        if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
          await navigator.storage.persist();
        }
      } catch {}
    })();

    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { fullSync } = await import("@/lib/sync");
        const { getSupabase } = await import("@/lib/supabase");
        fullSync();
        const sb = getSupabase();
        if (sb) {
          const { data } = sb.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN") fullSync(true);
          });
          unsub = () => data.subscription.unsubscribe();
        }
      } catch {}
    })();
    return () => unsub?.();
  }, []);

  return (
    <div className="lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:bg-[radial-gradient(120%_120%_at_50%_0%,#1b1b22_0%,#000_60%)] lg:p-10">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-paper lg:h-[86vh] lg:min-h-0 lg:w-full lg:max-w-5xl lg:flex-row lg:overflow-hidden lg:rounded-2xl lg:border lg:border-hairline lg:shadow-[0_30px_80px_rgb(0_0_0/0.8)]">
        <Sidebar />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <StatusBar title={title} count={count} />
          <div className="fade-up flex min-h-0 flex-1 flex-col lg:overflow-y-auto">{children}</div>
          <TabBar />
        </div>
      </div>
    </div>
  );
}
