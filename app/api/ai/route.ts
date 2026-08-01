import { NextRequest, NextResponse } from "next/server";

// Claude lives ONLY on the subjective layer — recaps and recommendations.
// Facts (setlists, dates, venues) always come from the real data sources, so
// the archive can never be poisoned by a hallucination.

const MODEL = "claude-sonnet-5"; // swap to "claude-haiku-4-5-20251001" for cheaper/faster

interface Body {
  mode: "recap" | "recs" | "event";
  stats: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ text: null, configured: false });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ text: null }); }

  const prompts: Record<Body["mode"], string> = {
    event: `A concert-goer is logging a show that isn't in setlist.fm or Wikipedia's tour tables. Here's what they gave you:
${JSON.stringify(body.stats, null, 2)}

Fill in what you actually know about this specific event (a festival edition, one-off show, or local date). Use only facts you're confident about — leave a field null rather than guessing, and never invent a set list.

Reply with ONLY this JSON, no other text:
{"artist":"headliner or main act","lineup":["other acts, most notable first"],"venue":"venue name","city":"city","country":"2-letter code","date":"YYYY-MM-DD","note":"one short sentence of context, or null","confidence":"high|medium|low"}`,
    recap: `Here is a music fan's concert data for one year:
${JSON.stringify(body.stats, null, 2)}

Write a short, warm recap of their year in live music — 3 short paragraphs, second person ("you"), like a friend who was paying attention. Reference only what's in the data; never invent shows, songs, or details. No headings, no bullet points, no emoji. End on something that makes them want to go to another show.`,
    recs: `Here is a music fan's concert history:
${JSON.stringify(body.stats, null, 2)}

Suggest 5 artists they'd likely enjoy seeing live but that do NOT appear in their history. Favour artists known for strong live shows. Return ONLY a JSON array, no other text: [{"artist":"Name","why":"one short sentence"}]`,
  };

  const prompt = prompts[body.mode];
  if (!prompt) return NextResponse.json({ text: null });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ text: null, error: `api ${res.status}` }, { status: 200 });
    }
    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ text, configured: true });
  } catch {
    return NextResponse.json({ text: null, error: "unreachable" });
  }
}
