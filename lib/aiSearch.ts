// Claude as a LAST-RESORT search interpreter.
//
// It never supplies facts to the app: it only guesses what the user meant
// ({artist, tour}), and that guess is then looked up in setlist.fm. If Claude
// invents a tour that doesn't exist, setlist.fm returns nothing and the guess
// dies there. Nothing unverified can reach the archive.

const cache = new Map<string, { v: { artist?: string; tour?: string } | null; exp: number }>();

export async function interpretQuery(q: string): Promise<{ artist?: string; tour?: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const ck = q.toLowerCase().trim();
  const hit = cache.get(ck);
  if (hit && Date.now() < hit.exp) return hit.v;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // cheap + fast; this runs only on a miss
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `A concert-app user searched: "${q}"

They're looking for a live show. Work out who the artist is and, if the query names a tour, what the official tour name is. Handle abbreviations, misspellings, nicknames and album-era references.

Reply with ONLY a JSON object, no other text:
{"artist":"Official Artist Name","tour":"Official Tour Name or null"}

If you can't tell who the artist is, reply {"artist":null,"tour":null}.`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const out = {
      artist: typeof parsed.artist === "string" ? parsed.artist : undefined,
      tour: typeof parsed.tour === "string" ? parsed.tour : undefined,
    };
    if (!out.artist && !out.tour) return null;
    if (cache.size > 500) cache.clear();
    cache.set(ck, { v: out, exp: Date.now() + 24 * 3600 * 1000 });
    return out;
  } catch {
    return null;
  }
}
