"use client";

// Local-first sync: localStorage stays the instant source of truth,
// Supabase mirrors it in the background. Newer updatedAt wins on merge.

import { getSupabase } from "./supabase";
import type { ConcertRec } from "@/features/concerts/data";

const KEY = "heard.concerts.v1";

function readLocal(): ConcertRec[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function writeLocal(list: ConcertRec[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("heard-sync"));
}

export async function pushConcert(c: ConcertRec) {
  const sb = getSupabase();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await sb.from("concerts").upsert({
    id: c.id,
    user_id: session.user.id,
    data: c,
    updated_at: new Date(c.updatedAt ?? Date.now()).toISOString(),
  }).then(() => {});
}

export async function removeConcertRemote(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await sb.from("concerts").delete().eq("id", id).then(() => {});
}

let lastSync = 0;

/** Pull remote, merge with local (newer wins), push anything remote is missing.
 *  Throttled to once a minute unless forced (e.g. right after sign-in). */
export async function fullSync(force = false) {
  if (!force && Date.now() - lastSync < 60_000) return;
  lastSync = Date.now();
  const sb = getSupabase();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const { data: rows, error } = await sb.from("concerts").select("id, data, updated_at");
  if (error) return;

  const local = readLocal();
  const localMap = new Map(local.map((c) => [c.id, c]));
  const merged = new Map<string, ConcertRec>(localMap);
  const toPush: ConcertRec[] = [];

  for (const row of rows ?? []) {
    const remote: ConcertRec = { ...row.data, updatedAt: +new Date(row.updated_at) };
    const mine = localMap.get(row.id);
    if (!mine || (remote.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      merged.set(row.id, remote);
    } else if ((mine.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
      toPush.push(mine);
    }
  }
  const remoteIds = new Set((rows ?? []).map((r: any) => r.id));
  for (const c of local) if (!remoteIds.has(c.id)) toPush.push(c);

  writeLocal([...merged.values()]);
  for (const c of toPush) await pushConcert(c);
}

/** Upload a media blob to Supabase Storage; returns a public URL or null. */
export async function uploadMedia(blob: Blob, id: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const ext = blob.type.startsWith("video/") ? "mp4" : "jpg";
  const path = `${session.user.id}/${id}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, {
    contentType: blob.type, upsert: true,
  });
  if (error) return null;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Delete a synced media file from Supabase Storage, given its public URL. */
export async function removeMediaRemote(urls: (string | null | undefined)[]) {
  const sb = getSupabase();
  if (!sb) return;
  const paths = urls
    .filter((u): u is string => !!u)
    .map((u) => u.split("/media/")[1])
    .filter(Boolean);
  if (paths.length) await sb.storage.from("media").remove(paths).then(() => {});
}
