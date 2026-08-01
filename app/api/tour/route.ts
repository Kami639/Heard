import { NextRequest, NextResponse } from "next/server";
import { fetchTourInfo, wikiTrace } from "@/lib/wikiTour";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  const artist = req.nextUrl.searchParams.get("artist");
  if (!name) return NextResponse.json({ tour: null });
  try {
    const tour = await fetchTourInfo(name, artist);
    return NextResponse.json({
      tour,
      ...(tour ? {} : { reason: wikiTrace[0]?.step ?? "not_found", trace: wikiTrace.slice(0, 4) }),
    });
  } catch (e: any) {
    return NextResponse.json({ tour: null, reason: "exception", detail: String(e?.message ?? e) });
  }
}
