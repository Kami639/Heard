import { NextRequest, NextResponse } from "next/server";

// Song previews with artist verification.
// Chain: iTunes (strict artist match) -> Deezer (strict) -> null.
// Never returns a preview whose artist doesn't match — wrong song > no song is false.

const norm = (x: string) =>
  x.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]/g, "");

function artistMatches(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function titleMatches(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb.slice(0, 14)) || nb.includes(na.slice(0, 14));
}

export async function GET(req: NextRequest) {
  const song = req.nextUrl.searchParams.get("song");
  const artist = req.nextUrl.searchParams.get("artist") ?? "";
  if (!song || !artist) return NextResponse.json({ previewUrl: null });

  // 1) iTunes
  try {
    const qs = new URLSearchParams({
      term: `${artist} ${song}`, media: "music", entity: "song", limit: "10",
    });
    const res = await fetch(`https://itunes.apple.com/search?${qs}`, {
      next: { revalidate: 604800 },
    });
    if (res.ok) {
      const items = (await res.json()).results ?? [];
      const hit = items.find(
        (r: any) =>
          r.previewUrl &&
          artistMatches(r.artistName ?? "", artist) &&
          titleMatches(r.trackName ?? "", song)
      );
      if (hit) return NextResponse.json({ previewUrl: hit.previewUrl });
    }
  } catch {}

  // 2) Deezer fallback (free, no key; must be called server-side)
  try {
    const q = `artist:"${artist}" track:"${song}"`;
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`,
      { next: { revalidate: 604800 } }
    );
    if (res.ok) {
      const items = (await res.json()).data ?? [];
      const hit = items.find(
        (r: any) =>
          r.preview &&
          artistMatches(r.artist?.name ?? "", artist) &&
          titleMatches(r.title ?? "", song)
      );
      if (hit) return NextResponse.json({ previewUrl: hit.preview });
    }
  } catch {}

  return NextResponse.json({ previewUrl: null });
}
