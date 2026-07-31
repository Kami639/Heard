import { NextRequest, NextResponse } from "next/server";
import { suggestArtists } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ artists: [] });
  try {
    return NextResponse.json({ artists: await suggestArtists(name) });
  } catch {
    return NextResponse.json({ artists: [] });
  }
}
