import { NextRequest, NextResponse } from "next/server";

/* Read a ticket (photo, screenshot or PDF) and pull out the show details.
   Claude only reads what's printed on the ticket — it isn't asked to recall
   anything — so this is extraction, not invention. The user confirms every
   field before it's saved. */

const MODEL = "claude-sonnet-5";

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ticket: null, configured: false });

  let body: { data?: string; mediaType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ticket: null }); }
  if (!body.data || !body.mediaType) return NextResponse.json({ ticket: null });

  const isPdf = body.mediaType === "application/pdf";
  const source = { type: "base64", media_type: body.mediaType, data: body.data };

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
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            isPdf ? { type: "document", source } : { type: "image", source },
            {
              type: "text",
              text: `This is a concert ticket. Read ONLY what is printed on it and return the details.

Reply with ONLY this JSON, no other text:
{"artist":"headline act","tour":"tour name or null","venue":"venue","city":"city","country":"2-letter code or null","date":"YYYY-MM-DD","price":number or null,"seat":"section/row/seat or null"}

Use null for anything not printed on the ticket. Do not guess or fill in from memory.`,
            },
          ],
        }],
      }),
    });
    if (!res.ok) return NextResponse.json({ ticket: null, error: `api ${res.status}` });

    const data = await res.json();
    const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const ticket = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json({ ticket, configured: true });
  } catch {
    return NextResponse.json({ ticket: null, error: "unreadable" });
  }
}
