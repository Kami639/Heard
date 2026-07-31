import { NextRequest, NextResponse } from "next/server";
import { searchArtist } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const artist = await searchArtist(name);
    return NextResponse.json({ artist });
  } catch {
    return NextResponse.json({ artist: null }, { status: 200 }); // degrade gracefully
  }
}
