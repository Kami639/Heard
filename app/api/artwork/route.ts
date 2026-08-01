import { NextRequest, NextResponse } from "next/server";
import { findArtwork } from "@/lib/spotify";
import { deezerAlbumArt, deezerArtistImage, itunesAlbumArt } from "@/lib/imagesFallback";
import { fetchTourImage } from "@/lib/wikiTour";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const tour = req.nextUrl.searchParams.get("tour");
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });
  const cleaned = (tour ?? "")
    .replace(/\b(the|world|tour|live|presents|arena|stadium|anniversary|\d{4})\b/gi, " ")
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // The tour's own promo art is the most accurate cover for that show.
  if (tour) {
    try {
      const poster = await fetchTourImage(tour, artist);
      if (poster) return NextResponse.json({ imageUrl: poster, source: "wikipedia" });
    } catch {}
  }
  try {
    const imageUrl = await findArtwork(artist, tour);
    if (imageUrl) return NextResponse.json({ imageUrl, source: "spotify" });
  } catch {}
  try {
    if (cleaned.length > 2) {
      const dz = await deezerAlbumArt(cleaned, artist);
      if (dz) return NextResponse.json({ imageUrl: dz, source: "deezer" });
    }
    const dzArtist = await deezerArtistImage(artist);
    if (dzArtist) return NextResponse.json({ imageUrl: dzArtist, source: "deezer" });
    if (cleaned.length > 2) {
      const it = await itunesAlbumArt(cleaned, artist);
      if (it) return NextResponse.json({ imageUrl: it, source: "itunes" });
    }
  } catch {}
  return NextResponse.json({ imageUrl: null, source: null });
}
