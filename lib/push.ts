"use client";

/* Web Push, client side.
 *
 * iOS supports this for INSTALLED PWAs on 16.4+ — inside Safari-the-browser
 * `Notification` simply doesn't exist, which is why `pushSupport()` checks
 * capabilities rather than user agents. Subscriptions are stored per-endpoint
 * in Supabase; a daily cron does the actual sending. */

import { getSupabase } from "./supabase";

export type PushSupport = "ready" | "needs-install" | "unsupported" | "no-server";

export function pushSupport(): PushSupport {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "no-server";
  if (typeof window === "undefined") return "unsupported";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (capable) return "ready";
  // iOS Safari (not installed): everything else works, Notification is absent.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (navigator as any).standalone === true
    || window.matchMedia?.("(display-mode: standalone)").matches;
  if (ios && !standalone) return "needs-install";
  return "unsupported";
}

function b64ToUint8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

/** Ask permission, subscribe, and store the subscription. Returns an error
 *  string for the UI, or null on success. */
export async function enablePush(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "Sync isn't configured.";
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return "Sign in first — notifications follow your account.";

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Notifications were declined. Enable them in Settings if you change your mind.";

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
    });
    const { error } = await sb.from("push_subscriptions").upsert({
      endpoint: sub.endpoint,
      user_id: session.user.id,
      subscription: sub.toJSON(),
    });
    if (error) return "Couldn't save the subscription — try again.";
    return null;
  } catch {
    return "Couldn't subscribe on this device.";
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const sb = getSupabase();
  if (sb) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}
