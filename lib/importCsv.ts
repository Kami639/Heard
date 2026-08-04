"use client";

/* Spreadsheet import — the door in for people who've kept their concert
 * history in Excel/Notes for years (most concert heads have). Forgiving on
 * purpose: commas, tabs, or semicolons; header row optional and in any
 * column order; dates in almost any format `new Date` can chew. */

import { splitArtists, type ConcertRec } from "@/features/concerts/data";
import { getConcerts, addConcert } from "./store";

export interface ParsedRow {
  artist: string; date: Date; venue: string; city: string; country?: string; tour?: string;
}
export interface ImportPreview {
  rows: ParsedRow[];
  skipped: number;    // unparseable lines
  duplicates: number; // already in the archive (same artist + night)
}

const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

function splitLine(line: string): string[] {
  const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
}

export function parseImport(text: string): ImportPreview {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 800);
  if (!lines.length) return { rows: [], skipped: 0, duplicates: 0 };

  // header? map columns by name; otherwise assume artist,date,venue,city,country
  let cols = { artist: 0, date: 1, venue: 2, city: 3, country: 4, tour: -1 };
  let start = 0;
  const head = splitLine(lines[0]).map(nk);
  if (head.some((h) => h.includes("artist") || h.includes("band")) && head.some((h) => h.includes("date"))) {
    const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
    cols = {
      artist: find("artist", "band", "act"),
      date: find("date", "when"),
      venue: find("venue", "location", "place"),
      city: find("city", "town"),
      country: find("country"),
      tour: find("tour", "festival", "event"),
    };
    start = 1;
  }

  const existing = new Set(
    getConcerts().map((c) => {
      const d = new Date(c.dateDisplay);
      return `${nk(c.artist)}|${isNaN(+d) ? c.dateDisplay : d.toISOString().slice(0, 10)}`;
    })
  );

  const rows: ParsedRow[] = [];
  let skipped = 0, duplicates = 0;
  const seen = new Set<string>();

  for (const line of lines.slice(start)) {
    const cells = splitLine(line);
    const artist = cells[cols.artist] ?? "";
    const rawDate = cells[cols.date] ?? "";
    const date = new Date(rawDate);
    if (!artist || !rawDate || isNaN(+date) || date.getFullYear() < 1950) { skipped++; continue; }
    const key = `${nk(artist)}|${date.toISOString().slice(0, 10)}`;
    if (existing.has(key) || seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    rows.push({
      artist,
      date,
      venue: cells[cols.venue] ?? "",
      city: cells[cols.city] ?? "",
      country: cols.country >= 0 ? (cells[cols.country] || undefined) : undefined,
      tour: cols.tour >= 0 ? (cells[cols.tour] || undefined) : undefined,
    });
  }
  return { rows: rows.slice(0, 500), skipped, duplicates };
}

/** Write the rows into the archive. Artist art heals in the background via
 *  the app's existing art-healer, so imports stay instant. */
export function commitImport(rows: ParsedRow[]): number {
  let n = 0;
  for (const r of rows) {
    const names = splitArtists(r.artist);
    const c: ConcertRec = {
      id: `import-${Date.now()}-${n}`,
      artist: r.artist,
      artists: names.map((name) => ({ name, imageUrl: null })),
      tour: r.tour ?? "Live",
      venue: r.venue || "Unknown venue",
      city: r.city,
      country: r.country?.toUpperCase(),
      dateDisplay: r.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      year: r.date.getFullYear(),
      setlist: [],
      rating: 0, price: 0, photos: 0, notes: "",
      c1: "#3a3a3c", c2: "#1c1c1e",
      initials: r.artist[0]?.toUpperCase() ?? "?",
      lat: null, lng: null,
    };
    addConcert(c);
    n++;
  }
  return n;
}
