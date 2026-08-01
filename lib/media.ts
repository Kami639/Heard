"use client";

/** IndexedDB media store — photos + videos live here (hundreds of MB),
 *  concert records in localStorage just keep {id, type} references. */

const DB = "heard-media", STORE = "media";

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function saveMedia(blob: Blob): Promise<string> {
  const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return id;
}

export async function getMedia(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((res) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => res(null);
  });
}

export async function deleteMedia(ids: string[]) {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  for (const id of ids) tx.objectStore(STORE).delete(id);
}
