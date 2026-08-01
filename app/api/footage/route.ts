import { NextRequest, NextResponse } from "next/server";
import { searchFootage } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist");
  const venue = sp.get("venue") ?? "";
  const date = sp.get("date") ?? "";
  if (!artist) return NextResponse.json({ videos: [] });
  try {
    const videos = await searchFootage(`${artist} ${venue} ${date} live`);
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] }); // no key / quota out -> links-only
  }
}
