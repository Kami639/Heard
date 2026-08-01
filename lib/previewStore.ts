// Hand-off for the preview screen. Kept in module memory (survives client-side
// navigation) with a localStorage backup (survives a hard refresh), so the
// Add flow can't break just because one storage API is unavailable.

let mem: any = null;
const KEY = "heard.preview.v1";

export function setPreview(v: any) {
  mem = v;
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}

export function getPreview(): any | null {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearPreview() {
  mem = null;
  try { localStorage.removeItem(KEY); } catch {}
}
