import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/* Daily notification sweep (Vercel Cron, see vercel.json).
 *
 * Two triggers per user, both computed from their synced archive:
 *  - "On this night": a past show whose month/day is today       → 💿
 *  - "Tomorrow":      a logged future show happening tomorrow    → 🎟️
 *
 * Runs with the service role (server only!) because it has to read every
 * user's rows. Dead endpoints (410/404) are pruned as it goes. */

export const maxDuration = 60;

function keyed(dateDisplay: string): { m: number; d: number; y: number } | null {
  const dt = new Date(dateDisplay);
  return isNaN(+dt) ? null : { m: dt.getMonth(), d: dt.getDate(), y: dt.getFullYear() };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!url || !service || !pub || !priv) {
    return NextResponse.json({ error: "push not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", pub, priv);
  const sb = createClient(url, service, { auth: { persistSession: false } });

  const { data: subs, error: subErr } = await sb.from("push_subscriptions").select("endpoint, user_id, subscription");
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ sent: 0, reason: "no subscriptions" });

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: rows, error: rowErr } = await sb
    .from("concerts").select("user_id, data").in("user_id", userIds);
  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });

  const byUser = new Map<string, any[]>();
  for (const r of rows ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r.data);
    byUser.set(r.user_id, list);
  }

  const now = new Date();
  const tomorrow = new Date(+now + 86400000);
  let sent = 0, pruned = 0;

  for (const userId of userIds) {
    const concerts = (byUser.get(userId) ?? []).filter((c) => !c?.cancelled && c?.dateDisplay);
    const messages: { title: string; body: string; url: string; tag: string }[] = [];

    for (const c of concerts) {
      const k = keyed(c.dateDisplay);
      if (!k) continue;
      if (k.m === now.getMonth() && k.d === now.getDate() && k.y < now.getFullYear()) {
        const years = now.getFullYear() - k.y;
        messages.push({
          title: `💿 On this night, ${years} ${years === 1 ? "year" : "years"} ago`,
          body: `${c.artist} · ${c.venue} · ${c.city}. Tap to relive it.`,
          url: `/concert/${c.id}`,
          tag: `anniv-${c.id}`,
        });
      }
      if (k.y === tomorrow.getFullYear() && k.m === tomorrow.getMonth() && k.d === tomorrow.getDate()) {
        messages.push({
          title: "🎟️ Show tomorrow",
          body: `${c.artist} at ${c.venue} — charge your phone, clear your camera roll.`,
          url: `/concert/${c.id}`,
          tag: `soon-${c.id}`,
        });
      }
    }
    if (!messages.length) continue;

    // cap at 2/day/user so a big archive can't spam its owner
    for (const msg of messages.slice(0, 2)) {
      for (const s of subs.filter((x) => x.user_id === userId)) {
        try {
          await webpush.sendNotification(s.subscription as any, JSON.stringify(msg));
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            pruned++;
          }
        }
      }
    }
  }

  return NextResponse.json({ sent, pruned, users: userIds.length });
}
