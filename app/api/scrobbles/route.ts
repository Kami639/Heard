import { NextRequest, NextResponse } from "next/server";

/* Streaming counts to sit beside live counts: "streamed 400 times, seen
 * twice." One call returns the listener's all-time top artists as a
 * name -> playcount map.
 *
 *  - Last.fm needs a (free) API key on the server.
 *  - ListenBrainz is keyless and open — the default if both are possible. */

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user")?.trim();
  const service = req.nextUrl.searchParams.get("service") ?? "listenbrainz";
  if (!user) return NextResponse.json({ error: "user required" }, { status: 400 });

  const plays: Record<string, number> = {};
  const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    if (service === "lastfm") {
      const key = process.env.LASTFM_API_KEY;
      if (!key) return NextResponse.json({ error: "LASTFM_API_KEY not set" }, { status: 500 });
      for (let page = 1; page <= 2; page++) {
        const qs = new URLSearchParams({
          method: "user.gettopartists", user, api_key: key, format: "json",
          limit: "500", page: String(page), period: "overall",
        });
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`, { next: { revalidate: 3600 * 12 } });
        if (!res.ok) break;
        const list = (await res.json())?.topartists?.artist ?? [];
        for (const a of list) plays[nk(a.name)] = Number(a.playcount) || 0;
        if (list.length < 500) break;
      }
    } else {
      const res = await fetch(
        `https://api.listenbrainz.org/1/stats/user/${encodeURIComponent(user)}/artists?range=all_time&count=500`,
        { next: { revalidate: 3600 * 12 } }
      );
      if (res.status === 404) return NextResponse.json({ error: "user not found" }, { status: 404 });
      if (!res.ok) return NextResponse.json({ error: `listenbrainz ${res.status}` }, { status: 502 });
      const list = (await res.json())?.payload?.artists ?? [];
      for (const a of list) plays[nk(a.artist_name)] = Number(a.listen_count) || 0;
    }
  } catch {
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }

  if (!Object.keys(plays).length) return NextResponse.json({ error: "no scrobbles found" }, { status: 404 });
  return NextResponse.json({ plays });
}
