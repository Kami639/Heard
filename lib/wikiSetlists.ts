import * as cheerio from "cheerio";
import { politeJson } from "./requestQueue";

/* Per-artist set lists, extracted from Wikipedia's RENDERED HTML.
 *
 * Wikitext can't be parsed reliably here: articles label each performer's set
 * in at least six different ways (";Drake", "'''Ken Carson set'''",
 * "=== Name ===", plus column/collapse template wrappers), and the label→list
 * association is exactly what naive parsing loses — which is how five Opium
 * sets ended up credited entirely to Playboi Carti.
 *
 * In rendered HTML every one of those forms reduces to "a label element,
 * followed by an <ol>/<ul>", so we anchor on labels and walk forward. */

export interface ArtistSet {
  artist: string;
  songs: string[];
  encoreFrom?: number | null;
}

const UA = {
  "User-Agent": "heard-concert-archive/1.0 (https://heard-beryl.vercel.app)",
  Accept: "application/json",
};

const SECTION_TITLES = /^(set ?lists?|typical set ?list|set list and songs|songs performed)$/i;

/** Prose that precedes a set list, never an artist label. */
const INTRO_RE = /set ?list|representative|obtained from|following|according to|source:/i;
/** Structural words that divide a set rather than name a performer. */
const DIVIDER_RE = /^(encore|encore \d+|notes?|set ?list|interlude|intro|outro|leg \d+|act \d+|part \d+|\d{4}|.*\bshow\b.*)$/i;

const squash = (s: string) => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const nk = (s: string) => s.toLowerCase().replace(/\s*&\s*/g, " and ").replace(/[^a-z0-9 ]/g, "").trim();

function cleanLabel(s: string): string {
  return squash(s)
    .replace(/\[\d+\]/g, "")
    .replace(/\s+set(list)?$/i, "")
    .replace(/[:•\-–—]\s*$/, "")
    .trim();
}

function cleanSong(s: string): string {
  return squash(s)
    .replace(/\[\d+\]/g, "")
    // "Lifestyle"/"PC5"  ->  Lifestyle / PC5
    .replace(/["“”]\s*\/\s*["“”]/g, " / ")
    // drop performance annotations: (played two times), (with dvsn)
    .replace(/\s*\((?:played|performed|with|feat\.?|interlude|snippet|reprise)[^)]*\)/gi, "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

/** Find the set list section's index, then fetch just that section's HTML. */
export async function fetchSetlistHtml(title: string): Promise<string | null> {
  const secs = await politeJson<any>(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: "parse", page: title, prop: "sections", format: "json", formatversion: "2", redirects: "1",
    })}`,
    { headers: UA, ttl: 7 * 24 * 3600 * 1000 }
  );

  const sections: any[] = secs?.parse?.sections ?? [];
  const match =
    sections.find((s) => SECTION_TITLES.test(squash(s.line ?? ""))) ??
    sections.find((s) => /set ?list/i.test(s.line ?? ""));

  const params: Record<string, string> = {
    action: "parse", page: title, prop: "text", format: "json", formatversion: "2", redirects: "1",
  };
  if (match?.index) params.section = String(match.index);

  const data = await politeJson<any>(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams(params)}`,
    { headers: UA, ttl: 7 * 24 * 3600 * 1000 }
  );
  return data?.parse?.text ?? null;
}

/** Label-anchored walk: for each performer label, take the lists that follow
 *  it up to the next label — descending into column/collapsible wrappers. */
export function parseSetlistHtml(html: string, knownArtists: string[] = [], headliner?: string, tourTitle?: string): ArtistSet[] {
  const $ = cheerio.load(html);
  const root: any = $(".mw-parser-output").length ? $(".mw-parser-output").first() : $.root();
  root.find("sup.reference, style, .mw-editsection").remove();

  const known = knownArtists.map(nk).filter(Boolean);
  const tourKey = tourTitle ? nk(tourTitle) : "";
  // "Glastonbury Festival" is an event, not the person who sang the song
  const isEventName = (name: string) => {
    const n = nk(name);
    if (!n) return true;
    if (tourKey && (n === tourKey || tourKey.includes(n) || n.includes(tourKey))) return true;
    if (/\b(festival|fest|tour|stage|weekend|day \d|night \d)\b/i.test(name) && !known.includes(n)) return true;
    return false;
  };
  const looksKnown = (name: string) => {
    const n = nk(name);
    if (!n) return false;
    return known.some((k) => k === n || (k.length > 3 && n.includes(k)) || (n.length > 3 && k.includes(n)));
  };

  const LABEL_SEL = "dl > dt, p > b, p > strong, .mw-heading h3, .mw-heading h4, h3 .mw-headline, h4 .mw-headline, h3, h4";

  const blockOf = (el: any) => {
    const $el = $(el);
    const block = $el.closest("dl, p, .mw-heading, h3, h4");
    return block.length ? block : $el;
  };

  const isLabelBlock = (el: any) => {
    const $el = $(el);
    if ($el.is(".mw-heading, h3, h4")) return true;
    if ($el.is("dl") && $el.children("dt").length > 0) return true;
    if ($el.is("p")) {
      const bold = $el.children("b, strong").first();
      if (!bold.length) return false;
      // bold that IS the paragraph = a label; bold inside a sentence = prose
      return squash(bold.text()).length >= squash($el.text()).length - 2;
    }
    return false;
  };

  // candidate labels, in document order
  const labels = root.find(LABEL_SEL).toArray().filter((el: any) => {
    const raw = squash($(el).text());
    if (!raw || raw.length > 60) return false;
    if (DIVIDER_RE.test(cleanLabel(raw))) return false;
    if (isEventName(cleanLabel(raw))) return false;
    if (INTRO_RE.test(raw) && !looksKnown(cleanLabel(raw))) return false;
    if (raw.split(/\s+/).length > 7) return false;
    return isLabelBlock(blockOf(el));
  });

  /** Walk forward from a label, collecting lists until the NEXT performer
   *  label. An "Encore" heading in between belongs to the same performer, so
   *  it marks a position instead of ending the set. */
  const collectParts = (anchor: any): { lists: any[]; encoreAt: number[] } => {
    const lists: any[] = [];
    const encoreAt: number[] = [];
    let node = $(anchor).next();

    while (node.length) {
      if (isLabelBlock(node)) {
        const text = cleanLabel($(node).text());
        if (DIVIDER_RE.test(text)) {
          if (/encore/i.test(text)) encoreAt.push(lists.length);
          node = node.next();
          continue; // still the same artist
        }
        break; // a new performer starts here
      }
      if (node.is("ol, ul")) lists.push(node);
      else {
        const inner = node.find("ol, ul"); // div-col, mw-collapsible-content, NavContent…
        inner.each((_: number, e: any) => { lists.push($(e)); });
      }
      node = node.next();
    }
    return { lists, encoreAt };
  };

  const readSongs = ({ lists, encoreAt }: { lists: any[]; encoreAt: number[] }) => {
    const songs: string[] = [];
    let encoreFrom: number | null = null;
    lists.forEach((list: any, li: number) => {
      if (encoreAt.includes(li) && encoreFrom === null) encoreFrom = songs.length;
      list.children("li").each((_: number, item: any): void => {
        const t = cleanSong($(item).text());
        if (!t) return;
        if (/^encore\b/i.test(t) && t.length < 14) { encoreFrom = songs.length; return; }
        songs.push(t);
      });
    });
    return { songs, encoreFrom };
  };

  const sets: ArtistSet[] = [];
  const seen = new Set<string>();

  for (const el of labels) {
    const label = cleanLabel($(el).text());
    if (!label || seen.has(nk(label))) continue;
    const { songs, encoreFrom } = readSongs(collectParts(blockOf(el)));
    if (!songs.length) continue;
    seen.add(nk(label));
    sets.push({ artist: label, songs, encoreFrom });
  }

  // no labels at all: one list belongs to the headliner
  if (!sets.length) {
    const lists = root.find("ol, ul").toArray().map((e: any) => $(e));
    const { songs, encoreFrom } = readSongs({ lists: lists.slice(0, 1), encoreAt: [] });
    if (songs.length && headliner) sets.push({ artist: headliner, songs, encoreFrom });
  }

  return sets.slice(0, 10);
}

/** Did parsing plausibly work? A multi-performer tour that yields one set is
 *  the exact silent failure that credits everything to the headliner. */
export function looksWrong(sets: ArtistSet[], knownPerformers: string[]): boolean {
  if (!sets.length) return true;
  if (sets.some((s) => !s.songs.length)) return true;
  const total = sets.reduce((n, s) => n + s.songs.length, 0);
  if (total < 3) return true;
  if (knownPerformers.length >= 2 && sets.length < 2) return true;
  return false;
}

/* ── LLM fallback ─────────────────────────────────────────────────────────
   Only runs when the deterministic walker fails its own validation, so it
   costs nothing in the normal case. Claude is used strictly as an extractor:
   it must return songs that appear verbatim in the source, and anything that
   doesn't survive that check is thrown away. A hallucinated song can't reach
   the archive.                                                            */

const STRIP = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function extractSetlistWithClaude(
  sourceText: string,
  knownArtists: string[]
): Promise<ArtistSet[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !sourceText.trim()) return null;

  const source = sourceText.slice(0, 40000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        temperature: 0,
        system:
          "You are a data-extraction function. Extract ONLY artist labels and song titles that appear verbatim in the provided text. Never add, complete, correct, or infer a song. If a performer has no list, return an empty songs array. Always answer with the tool.",
        tools: [{
          name: "record_setlist",
          description: "Record each performer's set list exactly as printed in the source.",
          input_schema: {
            type: "object",
            properties: {
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    artist: { type: "string", description: "performer name, without a trailing 'set'" },
                    songs: { type: "array", items: { type: "string" } },
                  },
                  required: ["artist", "songs"],
                },
              },
            },
            required: ["sets"],
          },
        }],
        tool_choice: { type: "tool", name: "record_setlist" },
        messages: [{
          role: "user",
          content: `Known performers on this tour: ${knownArtists.join(", ") || "unknown"}.

Below is the set list section of a Wikipedia concert tour article. Each performer's songs are listed under their own label. Split the songs by performer.

---
${source}
---`,
        }],
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const call = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "record_setlist");
    const sets: any[] = call?.input?.sets ?? [];
    if (!sets.length) return null;

    // verbatim check — the guarantee that nothing was invented
    const haystack = STRIP(source);
    let kept = 0, dropped = 0;
    const verified: ArtistSet[] = [];

    for (const set of sets) {
      if (typeof set?.artist !== "string" || !Array.isArray(set.songs)) continue;
      const songs = set.songs.filter((song: unknown) => {
        if (typeof song !== "string" || !song.trim()) return false;
        const ok = haystack.includes(STRIP(song));
        ok ? kept++ : dropped++;
        return ok;
      });
      if (songs.length) verified.push({ artist: cleanLabel(set.artist), songs });
    }

    // if the model was inventing, discard the whole thing
    if (!verified.length || dropped > kept * 0.1) return null;
    return verified.slice(0, 10);
  } catch {
    return null;
  }
}
