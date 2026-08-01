/* Matching stylized song titles to catalogue tracks.
 *
 * Artists stylize titles ("FE!N", "Evil J0rdan", "Wake Up F1lthy", "Facet!me")
 * and fans type them that way on setlist.fm, but iTunes/Deezer may store
 * either the stylized or the plain spelling. Naive fuzzy matching bridges that
 * gap — and then happily matches "X" to any song with an x in it.
 *
 * So: normalize aggressively (including leetspeak), but require near-exact
 * agreement, with the bar scaled to title length. A short title must match
 * exactly. When nothing clears the bar we return nothing — silence is always
 * better than confidently playing the wrong song.
 */

/** Characters artists swap in, and the letters they stand for. */
const LEET: Record<string, string[]> = {
  "0": ["o"], "1": ["i", "l"], "3": ["e"], "4": ["a"], "5": ["s"],
  "6": ["g"], "7": ["t"], "8": ["b"], "9": ["g"],
  "!": ["i", ""], "|": ["l", "i"], "@": ["a"], "$": ["s"], "+": ["t"],
  "£": ["l"], "€": ["e"], "¥": ["y"], "×": ["x"],
};

/** Qualifiers that describe a version, not the song. */
const QUALIFIER =
  /\s*[([]\s*(?:feat|ft|featuring|with|prod|remix|live|acoustic|remaster(?:ed)?|edit|version|mix|explicit|clean|bonus|deluxe|interlude|intro|outro|snippet|reprise|demo)\b[^)\]]*[)\]]/gi;

/** Catalogue pollution: karaoke/tribute uploads that copy real titles. */
const JUNK_ARTIST =
  /\b(karaoke|tribute|made famous by|originally performed|in the style of|instrumental|cover band|8[- ]?bit|lullaby|piano tribute|workout mix|ringtone|cast recording)\b/i;

const strip = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); // drop diacritics

/** All plausible readings of a title. "Evil J0rdan" -> {eviljordan},
 *  "FE!N" -> {fein, fen}. Purely numeric words are left alone so "2024",
 *  "9" and "10 Freaky Girls" don't get mangled into letters. */
export function titleVariants(raw: string): Set<string> {
  const base = strip(raw)
    .toLowerCase()
    .replace(QUALIFIER, " ")
    .replace(/\s*-\s*(?:single|ep|radio edit|remaster(?:ed)?.*)$/i, " ")
    .replace(/&/g, " and ")
    .trim();

  const words = base.split(/\s+/).filter(Boolean);
  let variants = [""];

  for (const word of words) {
    const numeric = /^[0-9]+$/.test(word);          // "2024", "9" stay numbers
    const mixed = /[a-z]/.test(word) && /[^a-z\s]/.test(word);
    const options = new Set<string>();

    if (numeric || !mixed) {
      options.add(word.replace(/[^a-z0-9]/g, ""));
    } else {
      // expand each substitutable character
      let forms = [""];
      for (const ch of word) {
        const subs = LEET[ch];
        const next: string[] = [];
        for (const f of forms) {
          if (subs) for (const sub of subs) next.push(f + sub);
          else if (/[a-z0-9]/.test(ch)) next.push(f + ch);
          else next.push(f); // drop other punctuation
        }
        forms = next.slice(0, 24);
      }
      forms.forEach((f) => options.add(f));
      options.add(word.replace(/[^a-z0-9]/g, "")); // and the literal reading
    }

    const merged: string[] = [];
    for (const v of variants) for (const o of options) merged.push(v + o);
    variants = [...new Set(merged)].slice(0, 32);
  }

  const out = new Set(variants.filter(Boolean));
  if (!out.size) out.add(base.replace(/[^a-z0-9]/g, ""));
  return out;
}

export function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 4) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** 0–1 similarity between two titles, stylization-aware. */
export function titleScore(query: string, candidate: string): number {
  const qs = titleVariants(query);
  const cs = titleVariants(candidate);
  for (const q of qs) if (cs.has(q)) return 1;

  let best = 0;
  for (const q of qs) {
    for (const c of cs) {
      const d = lev(q, c);
      if (d >= 99) continue;
      best = Math.max(best, 1 - d / Math.max(q.length, c.length, 1));
    }
  }
  return best;
}

/** How close a match has to be, given how much title there is to be wrong
 *  about. "X" and "I" must be exact; long titles can absorb a typo. */
export function titleAccepted(query: string, candidate: string): boolean {
  const score = titleScore(query, candidate);
  const len = Math.min(...[...titleVariants(query)].map((v) => v.length));
  if (len <= 6) return score === 1;   // short titles: exact or nothing
  if (len <= 12) return score >= 0.92;
  return score >= 0.86;
}

const artistKey = (s: string) =>
  strip(s)
    .toLowerCase()
    .replace(/\s*(?:feat\.?|ft\.?|featuring|with|vs\.?|&|,|\+|x)\s+.*$/i, "")
    .replace(/[^a-z0-9]/g, "");

/** Same artist? Exact after normalizing, or one typo on a long name. */
export function artistAccepted(found: string, expected: string): boolean {
  const a = artistKey(found), b = artistKey(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 6 && b.length >= 6 && lev(a, b) <= 1;
}

export function isJunkArtist(name: string): boolean {
  return JUNK_ARTIST.test(name);
}

export interface Candidate {
  title: string;
  artist: string;
  previewUrl?: string | null;
  durationMs?: number | null;
}

/** Pick the best catalogue track for a setlist entry, or nothing at all. */
export function pickTrack(
  candidates: Candidate[],
  song: string,
  artists: string[]
): Candidate | null {
  let best: { c: Candidate; score: number } | null = null;

  for (const c of candidates) {
    if (!c.title || !c.artist) continue;
    if (isJunkArtist(c.artist)) continue;                     // karaoke etc.
    if (!artists.some((a) => artistAccepted(c.artist, a))) continue;
    if (!titleAccepted(song, c.title)) continue;
    if (c.durationMs != null && (c.durationMs < 30_000 || c.durationMs > 900_000)) continue;

    // prefer an exact title, then a playable preview
    const score = titleScore(song, c.title) + (c.previewUrl ? 0.05 : 0);
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}
