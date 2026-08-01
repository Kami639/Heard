import { NextRequest, NextResponse } from "next/server";

// iTunes Search API: free, no key, returns 30-second song previews.
export async function GET(req: NextRequest) {
  const song = req.nextUrl.searchParams.get("song");
  const artist = req.nextUrl.searchParams.get("artist") ?? "";
  if (!song) return NextResponse.json({ previewUrl: null });

  try {
    const qs = new URLSearchParams({
      term: `${artist} ${song}`,
      media: "music",
      entity: "song",
      limit: "5",
    });
    const res = await fetch(`https://itunes.apple.com/search?${qs}`, {
      next: { revalidate: 604800 }, // previews don't change; cache a week
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const items = data.results ?? [];
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    const best =
      items.find(
        (r: any) =>
          norm(r.artistName ?? "").includes(norm(artist).slice(0, 12)) &&
          norm(r.trackName ?? "").includes(norm(song).slice(0, 12))
      ) ?? items[0];
    return NextResponse.json({ previewUrl: best?.previewUrl ?? null });
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}
