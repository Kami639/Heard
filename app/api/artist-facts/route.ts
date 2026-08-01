import { NextRequest, NextResponse } from "next/server";
import { politeJson } from "@/lib/requestQueue";

/** An artist's birth/formation date, from MusicBrainz — powers the
 *  "saw them on their own birthday" badge. */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ born: null });

  const qs = new URLSearchParams({ query: `artist:"${name.replace(/"/g, "")}"`, fmt: "json", limit: "3" });
  const data = await politeJson<any>(`https://musicbrainz.org/ws/2/artist?${qs}`, {
    ttl: 30 * 24 * 3600 * 1000,
  });

  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = (data?.artists ?? []).find((a: any) => nk(a.name ?? "") === nk(name));
  const born = hit?.["life-span"]?.begin ?? null;

  // only a full date is useful here
  return NextResponse.json({ born: born && /^\d{4}-\d{2}-\d{2}$/.test(born) ? born : null });
}
