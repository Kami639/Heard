import { NextRequest, NextResponse } from "next/server";
import { searchArtist } from "@/lib/spotify";
import { deezerArtists } from "@/lib/imagesFallback";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const configured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  try {
    const artist = await searchArtist(name);
    if (artist?.imageUrl) return NextResponse.json({ artist, configured, source: "spotify" });
  } catch {}
  // Spotify failed or empty -> Deezer backup (no key needed)
  try {
    const list = await deezerArtists(name, 5);
    const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Deezer has duplicate/bootleg entries for big artists — among exact
    // name matches, the real one is the one with the fans.
    const exact = list.filter((x) => nk(x.name) === nk(name))
      .sort((x, y) => ((y as any).followers ?? 0) - ((x as any).followers ?? 0));
    const a = exact[0] ?? list.find((x) => nk(x.name).includes(nk(name)));
    if (a) {
      return NextResponse.json({
        artist: { name: a.name, imageUrl: a.imageUrl, genres: [], popularity: a.popularity, followers: (a as any).followers ?? 0 },
        configured, source: "deezer",
      });
    }
  } catch {}
  return NextResponse.json({ artist: null, configured, source: null }, { status: 200 });
}
