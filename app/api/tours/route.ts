import { NextRequest, NextResponse } from "next/server";
import { fetchArtistTours } from "@/lib/wikiTour";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  if (!artist) return NextResponse.json({ tours: [] });
  try {
    return NextResponse.json({ tours: await fetchArtistTours(artist) });
  } catch {
    return NextResponse.json({ tours: [] });
  }
}
