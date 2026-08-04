import { splitArtists, type ConcertRec } from "./concerts/data";

/* ═══ THE HEARDIES ═══
 * The archive's own award show. Every category is computed from what
 * actually happened — winners AND nominees, because the reveal is the fun.
 * Categories with no real competition simply don't appear. */

export interface Nominee { title: string; sub: string; concertId?: string }
export interface Category {
  id: string; icon: string; label: string;
  winner: Nominee; nominees: Nominee[]; // nominees EXCLUDES the winner
}

const nightScore = (c: ConcertRec) =>
  c.rating * 100 + (c.moments?.length ?? 0) * 10 + (c.media?.length ?? 0) * 3 + c.setlist.length;

function top<T>(m: Map<string, T[]>, n = 4): [string, T[]][] {
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, n);
}

export function computeHeardies(concerts: ConcertRec[], year: number | "all"): Category[] {
  const cs = concerts.filter(
    (c) => !c.cancelled && (year === "all" || c.year === year) && +new Date(c.dateDisplay) <= Date.now()
  );
  if (!cs.length) return [];
  const out: Category[] = [];
  const showSub = (c: ConcertRec) => `${c.venue} · ${c.dateDisplay}`;

  /* 🏆 Show of the Year — rating, then how much of the night got kept */
  {
    const ranked = [...cs].sort((a, b) => nightScore(b) - nightScore(a));
    if (ranked.length >= 2) {
      out.push({
        id: "show", icon: "🏆", label: year === "all" ? "Show of a Lifetime" : "Show of the Year",
        winner: { title: ranked[0].artist, sub: showSub(ranked[0]), concertId: ranked[0].id },
        nominees: ranked.slice(1, 4).map((c) => ({ title: c.artist, sub: showSub(c), concertId: c.id })),
      });
    }
  }

  /* 🎤 Artist of the Year — most nights */
  {
    const byArtist = new Map<string, ConcertRec[]>();
    for (const c of cs) for (const a of splitArtists(c.artist))
      byArtist.set(a, [...(byArtist.get(a) ?? []), c]);
    const ranked = top(byArtist);
    if (ranked.length >= 2 && ranked[0][1].length >= 2) {
      out.push({
        id: "artist", icon: "🎤", label: "Artist of the Year",
        winner: { title: ranked[0][0], sub: `${ranked[0][1].length} nights` },
        nominees: ranked.slice(1).map(([a, list]) => ({ title: a, sub: `${list.length} ${list.length === 1 ? "night" : "nights"}` })),
      });
    }
  }

  /* 🏟 Venue of the Year */
  {
    const byVenue = new Map<string, ConcertRec[]>();
    for (const c of cs) if (c.venue && c.venue !== "Unknown venue")
      byVenue.set(c.venue, [...(byVenue.get(c.venue) ?? []), c]);
    const ranked = top(byVenue);
    if (ranked.length >= 2 && ranked[0][1].length >= 2) {
      out.push({
        id: "venue", icon: "🏟", label: "Venue of the Year",
        winner: { title: ranked[0][0], sub: `${ranked[0][1].length} nights · ${ranked[0][1][0].city}` },
        nominees: ranked.slice(1).map(([v, list]) => ({ title: v, sub: `${list.length} ${list.length === 1 ? "night" : "nights"}` })),
      });
    }
  }

  /* 🎶 Song of the Year — heard live the most */
  {
    const bySong = new Map<string, { display: string; n: number }>();
    for (const c of cs) for (const s of c.setlist) {
      const k = s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!k) continue;
      const cur = bySong.get(k);
      bySong.set(k, { display: s, n: (cur?.n ?? 0) + 1 });
    }
    const ranked = [...bySong.values()].sort((a, b) => b.n - a.n).slice(0, 4);
    if (ranked.length >= 2 && ranked[0].n >= 2) {
      out.push({
        id: "song", icon: "🎶", label: "Song of the Year",
        winner: { title: ranked[0].display, sub: `heard live ${ranked[0].n}×` },
        nominees: ranked.slice(1).map((s) => ({ title: s.display, sub: `heard live ${s.n}×` })),
      });
    }
  }

  /* 💸 The Splurge */
  {
    const priced = cs.filter((c) => c.price > 0).sort((a, b) => b.price - a.price);
    if (priced.length >= 2) {
      out.push({
        id: "splurge", icon: "💸", label: "The Splurge",
        winner: { title: priced[0].artist, sub: `$${priced[0].price} · ${priced[0].venue}`, concertId: priced[0].id },
        nominees: priced.slice(1, 4).map((c) => ({ title: c.artist, sub: `$${c.price}`, concertId: c.id })),
      });
    }
  }

  /* 🎪 Festival of the Year */
  {
    const fests = cs.filter((c) => c.festival).sort((a, b) => nightScore(b) - nightScore(a));
    if (fests.length >= 1) {
      out.push({
        id: "fest", icon: "🎪", label: "Festival of the Year",
        winner: { title: fests[0].festival!, sub: showSub(fests[0]), concertId: fests[0].id },
        nominees: fests.slice(1, 4).map((c) => ({ title: c.festival!, sub: c.dateDisplay, concertId: c.id })),
      });
    }
  }

  /* 🎁 Best Cameo — the night with the most surprise guests */
  {
    const guested = cs.filter((c) => (c.guests?.length ?? 0) > 0)
      .sort((a, b) => (b.guests?.length ?? 0) - (a.guests?.length ?? 0));
    if (guested.length >= 2) {
      out.push({
        id: "cameo", icon: "🎁", label: "Best Cameo",
        winner: {
          title: (guested[0].guests ?? []).slice(0, 2).join(" & "),
          sub: `pulled up at ${guested[0].artist}`, concertId: guested[0].id,
        },
        nominees: guested.slice(1, 4).map((c) => ({
          title: (c.guests ?? [])[0] ?? "", sub: `at ${c.artist}`, concertId: c.id,
        })),
      });
    }
  }

  /* 🤝 Ride or Die — the person you saw the most shows with */
  {
    const byCrew = new Map<string, ConcertRec[]>();
    for (const c of cs) for (const name of c.crew ?? [])
      byCrew.set(name, [...(byCrew.get(name) ?? []), c]);
    const ranked = top(byCrew);
    if (ranked.length >= 1 && ranked[0][1].length >= 2) {
      out.push({
        id: "crew", icon: "🤝", label: "Ride or Die",
        winner: { title: ranked[0][0], sub: `${ranked[0][1].length} shows together` },
        nominees: ranked.slice(1).map(([n, list]) => ({ title: n, sub: `${list.length} shows` })),
      });
    }
  }

  /* 🌱 Discovery of the Year — best first-timer (needs a year, not all-time) */
  if (year !== "all") {
    const before = new Map<string, number>();
    for (const c of concerts) if (!c.cancelled && c.year < year)
      for (const a of splitArtists(c.artist)) before.set(a, 1);
    const firstTimers = cs
      .filter((c) => c.rating >= 4 && splitArtists(c.artist).every((a) => !before.has(a)))
      .sort((a, b) => nightScore(b) - nightScore(a));
    if (firstTimers.length >= 2) {
      out.push({
        id: "discovery", icon: "🌱", label: "Discovery of the Year",
        winner: { title: firstTimers[0].artist, sub: `first time · ${"★".repeat(firstTimers[0].rating)}`, concertId: firstTimers[0].id },
        nominees: firstTimers.slice(1, 4).map((c) => ({ title: c.artist, sub: "first time", concertId: c.id })),
      });
    }
  }

  return out;
}
