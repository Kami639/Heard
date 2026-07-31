import { NextRequest, NextResponse } from "next/server";
import { findArtwork } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const tour = req.nextUrl.searchParams.get("tour");
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });
  try {
    const imageUrl = await findArtwork(artist, tour);
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
