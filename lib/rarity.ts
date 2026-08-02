"use client";

/* Badge rarity.
 *
 * Signed-in users mirror their unlocked badge ids to `badge_unlocks`;
 * a security-definer aggregate tells everyone what % of users hold each
 * badge. Nothing individual is readable — only the counts.
 *
 * Offline / signed-out, badges still get a rarity TIER estimated from
 * their point value, so the UI never shows a hole. Real percentiles
 * replace the estimate the moment community data exists. */

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import type { Achievement } from "@/features/achievements";

const CACHE_KEY = "heard.rarity.v1";
const PUSHED_KEY = "heard.rarity.pushed.v1";
const DAY = 24 * 3600 * 1000;

export interface RarityMap {
  total: number;
  pct: Record<string, number>; // badge id -> % of users holding it (0-100)
}

/* ── tiers ─────────────────────────────────────────────────────────── */

export type Tier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export function tierOf(pct: number): Tier {
  if (pct <= 2) return "legendary";
  if (pct <= 8) return "epic";
  if (pct <= 25) return "rare";
  if (pct <= 55) return "uncommon";
  return "common";
}

/** No community data yet? Estimate a tier from the badge's point value. */
export function estimatedTier(a: Achievement): Tier {
  if (a.pts >= 60) return "legendary";
  if (a.pts >= 40) return "epic";
  if (a.pts >= 25) return "rare";
  if (a.pts >= 15) return "uncommon";
  return "common";
}

export const TIER_STYLE: Record<Tier, { label: string; cls: string }> = {
  common:    { label: "COMMON",    cls: "bg-card2 text-sub" },
  uncommon:  { label: "UNCOMMON",  cls: "bg-[#2b3a2b] text-[#8fd694]" },
  rare:      { label: "RARE",      cls: "bg-[#22303f] text-[#7cb8ff]" },
  epic:      { label: "EPIC",      cls: "bg-[#33253f] text-[#c79bff]" },
  legendary: { label: "LEGENDARY", cls: "bg-[#3f2f1a] text-accent" },
};

/* ── community data ────────────────────────────────────────────────── */

function readCache(): { at: number; data: RarityMap } | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"); } catch { return null; }
}

/** Fetch community rarity (cached for a day). Null until ≥3 users exist —
 *  percentages from a sample of one are just noise. */
export async function fetchRarity(force = false): Promise<RarityMap | null> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < DAY) return cached.data;

  const sb = getSupabase();
  if (!sb) return cached?.data ?? null;
  const { data, error } = await sb.rpc("badge_rarity");
  if (error || !data) return cached?.data ?? null;

  const total = Number(data[0]?.total ?? 0);
  if (total < 3) return null;
  const pct: Record<string, number> = {};
  for (const row of data as { badge_id: string; holders: number }[]) {
    pct[row.badge_id] = Math.max(1, Math.round((Number(row.holders) / total) * 100));
  }
  const map = { total, pct };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: map })); } catch {}
  return map;
}

/** Mirror this device's unlocked set upstream. Cheap: only sends deltas. */
export async function pushUnlocks(ids: string[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  let pushed: string[] = [];
  try { pushed = JSON.parse(localStorage.getItem(PUSHED_KEY) ?? "[]"); } catch {}
  const fresh = ids.filter((id) => !pushed.includes(id));
  if (!fresh.length) return;

  const rows = fresh.map((badge_id) => ({ user_id: session.user.id, badge_id }));
  const { error } = await sb.from("badge_unlocks").upsert(rows, { onConflict: "user_id,badge_id" });
  if (!error) {
    try { localStorage.setItem(PUSHED_KEY, JSON.stringify([...pushed, ...fresh])); } catch {}
  }
}

/** Rarity map + a helper that resolves any badge to (pct | null, tier). */
export function useRarity(unlockedIds: string[]) {
  const [map, setMap] = useState<RarityMap | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRarity().then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, []);

  // mirror unlocks upstream whenever the set grows
  useEffect(() => {
    if (unlockedIds.length) pushUnlocks(unlockedIds).catch(() => {});
  }, [unlockedIds.join(",")]);

  return {
    total: map?.total ?? 0,
    lookup(a: Achievement): { pct: number | null; tier: Tier } {
      const pct = map?.pct[a.id];
      if (pct != null) return { pct, tier: tierOf(pct) };
      return { pct: null, tier: estimatedTier(a) };
    },
  };
}
