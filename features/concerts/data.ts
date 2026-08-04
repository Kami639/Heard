export interface ConcertRec {
  id: string;
  artist: string;
  tour: string;
  venue: string;
  city: string;
  country?: string;
  dateDisplay: string;
  year: number;
  rating: number;
  price: number;
  c1: string;
  c2: string;
  initials: string;
  photos: number;
  notes: string;
  setlist: string[];
  imageUrl?: string | null;
  photosData?: string[]; // legacy compressed dataURLs
  media?: { id: string; type: "image" | "video"; url?: string | null; durationSec?: number }[];
  updatedAt?: number;
  hlc?: string;
  info?: string | null;
  genres?: string[];
  covers?: Record<string, string>; // song -> original artist
  guests?: string[]; // artists who pulled up mid-set
  songArtists?: Record<string, string>; // song -> who performed it
  openers?: string[];
  attendance?: string | null;
  wikiSourced?: boolean;
  setlistFromWiki?: boolean;
  songGuests?: Record<string, string[]>;
  lineupChecked?: boolean;
  tourArtChecked?: boolean;
  moments?: string[];
  festival?: string | null; // set when this record is a festival day, not a single-bill show
  crew?: string[]; // the people you were there with
  tourPosition?: { index: number; total: number };
  encoreCount?: number;
  ticketScanned?: boolean;
  creditsChecked?: boolean;
  creditsVersion?: number;
  geoChecked?: boolean;
  geoApprox?: boolean;
  lat?: number | null;
  lng?: number | null;
  cancelled?: boolean;
  artists?: { name: string; imageUrl?: string | null }[];
}

export const SEED_CONCERTS: ConcertRec[] = [];

export const MOCK_SEARCH: Omit<ConcertRec, "rating" | "price" | "photos" | "notes">[] = [
  {
    id: "charli-bk-2026", artist: "Charli XCX", tour: "BRAT 2026 Arena Tour",
    venue: "Barclays Center", city: "Brooklyn", dateDisplay: "Mar 14 2026", year: 2026,
    c1: "#7E8C2B", c2: "#1E220A", initials: "C",
    setlist: ["360","Club classics","Von dutch","Apple","Guess","365"],
  },
  {
    id: "frank-hb-2026", artist: "Frank Ocean", tour: "Blond Anniversary",
    venue: "Hollywood Bowl", city: "Los Angeles", dateDisplay: "Aug 20 2026", year: 2026,
    c1: "#3E6E5E", c2: "#0E1A16", initials: "F",
    setlist: ["Nikes","Ivy","Pink + White","Solo","Nights","Self Control"],
  },
  {
    id: "bey-sofi-2026", artist: "Beyoncé", tour: "Act III",
    venue: "SoFi Stadium", city: "Inglewood", dateDisplay: "Jun 06 2026", year: 2026,
    c1: "#8C6A2B", c2: "#221A0A", initials: "B",
    setlist: ["AMERIICAN REQUIEM","TEXAS HOLD 'EM","16 CARRIAGES","JOLENE"],
  },
];

/** "Chris Brown & Usher" / "Teezo x Tyler" -> ["Chris Brown", "Usher"] */
export function splitArtists(name: string): string[] {
  return name
    .split(/\s*(?:&|\+|,|\/)\s*|\s+(?:and|x|con)\s+/i)
    .map((x) => x.trim())
    .filter((x) => x && !/^(more|others)$/i.test(x))
    .slice(0, 4);
}

/** Setlist entries that are actually notes, not songs
 *  ("This set was cancelled due to weather...", etc.) */
export function isNoteEntry(name: string): boolean {
  return (
    name.length > 70 ||
    /\b(cancell?ed|postponed|cut short|did not perform|no setlist|confirmed by)\b/i.test(name)
  );
}

const cleanName = (x: string) => x.replace(/[\u00A0\u2000-\u200B]/g, " ").replace(/\s+/g, " ").trim();

/** Runs on every read: strips note entries, flags cancellations, and
 *  normalizes names (whitespace ghosts) — auto-corrects existing archives. */
export function sanitizeConcert(c: ConcertRec): ConcertRec {
  const notes = c.setlist.filter(isNoteEntry);
  const cleaned: ConcertRec = {
    ...c,
    artist: cleanName(c.artist),
    tour: cleanName(c.tour ?? ""),
    venue: cleanName(c.venue),
    city: cleanName(c.city),
    artists: c.artists?.map((a) => ({ ...a, name: cleanName(a.name) })),
  };
  if (!notes.length) return cleaned;
  return {
    ...cleaned,
    setlist: cleaned.setlist.filter((s) => !isNoteEntry(s)),
    info: cleaned.info ?? notes.join(" · "),
    cancelled: cleaned.cancelled || notes.some((n) => /cancell?ed|postponed/i.test(n)),
  };
}

/** One event = one show, even if it was logged per-artist (festival days,
 *  multi-headliner tours). Keyed by venue + date. */
export function uniqueShowCount(cs: ConcertRec[]): number {
  return new Set(
    cs.filter((c) => !c.cancelled)
      .map((c) => `${c.venue.toLowerCase().replace(/\s+/g, "")}|${c.dateDisplay}`)
  ).size;
}
