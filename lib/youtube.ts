// Server-only YouTube Data API wrapper — fan footage search.
// Free API key from Google Cloud (YouTube Data API v3). ~100 searches/day
// on the default quota, so responses are cached for a day.

export interface FootageVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
}

export async function searchFootage(q: string, max = 8): Promise<FootageVideo[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");

  const qs = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(max),
    q,
    key,
    safeSearch: "moderate",
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const data = await res.json();
  return (data.items ?? [])
    .filter((i: any) => i.id?.videoId)
    .map((i: any) => ({
      videoId: i.id.videoId,
      title: i.snippet?.title ?? "",
      thumbnail: i.snippet?.thumbnails?.high?.url ?? i.snippet?.thumbnails?.default?.url ?? "",
      channel: i.snippet?.channelTitle ?? "",
    }));
}
