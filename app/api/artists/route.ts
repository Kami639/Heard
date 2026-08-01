import { NextRequest, NextResponse } from "next/server";
import { suggestArtists } from "@/lib/spotify";
import { deezerArtists } from "@/lib/imagesFallback";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ artists: [] });
  try {
    const artists = await suggestArtists(name);
    if (artists.length) return NextResponse.json({ artists });
  } catch {}
  try {
    const artists = (await deezerArtists(name, 5)).map((a) => ({ ...a, genres: [] }));
    return NextResponse.json({ artists });
  } catch {
    return NextResponse.json({ artists: [] });
  }
}
