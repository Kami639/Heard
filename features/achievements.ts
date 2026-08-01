import type { ConcertRec } from "./concerts/data";
import { continentOf } from "@/lib/continents";
import { splitArtists } from "./concerts/data";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Must-see acts — their live energy is the stuff of legend. */
export const LEGENDS = [
  "Usher", "Drake", "Chris Brown", "Lil Wayne", "Nicki Minaj", "Beyoncé", "Jay-Z",
  "Kanye West", "Ye", "Rihanna", "Eminem", "Kendrick Lamar", "Snoop Dogg", "50 Cent",
  "Missy Elliott", "Busta Rhymes", "Erykah Badu", "Lauryn Hill", "Nas", "OutKast",
  "Mary J. Blige", "Alicia Keys", "Mariah Carey", "Stevie Wonder", "Prince",
  "Madonna", "U2", "Coldplay", "Paul McCartney", "The Rolling Stones", "Elton John",
  "Billy Joel", "Bruce Springsteen", "Metallica", "Green Day", "Red Hot Chili Peppers",
  "Taylor Swift", "Adele", "Ed Sheeran", "Bruno Mars", "The Weeknd", "Justin Bieber",
  "Travis Scott", "Future", "J. Cole", "SZA", "Frank Ocean", "Tyler, The Creator",
  "NBA YoungBoy", "YoungBoy Never Broke Again", "Lil Uzi Vert", "Lil Yachty",
];

/** Scene rosters — label affiliations and sounds. */
const OPIUM = ["Playboi Carti", "Ken Carson", "Destroy Lonely", "Homixide Gang", "Homixide Gvng", "HXG"];
const YSL = ["Young Thug", "Gunna", "Lil Keed", "Yak Gotti", "Strick", "Lil Duke", "T-Shyne", "Karlae"];
const RAGE = ["Yeat", "Playboi Carti", "Ken Carson", "Destroy Lonely", "SoFaygo", "Trippie Redd", "Summrs", "Autumn!"];
/** Artists who almost never perform — catching one live is genuinely rare. */
const RARE = [
  "NBA YoungBoy", "YoungBoy Never Broke Again", "Frank Ocean", "Rihanna", "Sade",
  "André 3000", "D'Angelo", "Jai Paul", "Dr. Dre", "Daft Punk", "Summer Walker",
  "Adele", "The Isley Brothers", "Lauryn Hill",
];
const UNDERGROUND = [
  "Summrs", "Autumn!", "Kankan", "Izaya Tiji", "Osamason", "Nettspend", "Xaviersobased",
  "Che", "Yung Fazo", "SGPWES", "redveil", "Yhapojj", "Lucki", "Bktherula", "Lazer Dim 700",
];

function sawAny(cs: ConcertRec[], roster: string[]): boolean {
  return cs.filter((c) => !c.cancelled).some((c) =>
    splitArtists(c.artist).some((a) => roster.some((r) => norm(r) === norm(a)))
  );
}

function hasGenre(cs: ConcertRec[], re: RegExp): boolean {
  return cs.filter((c) => !c.cancelled).some((c) => (c.genres ?? []).some((g) => re.test(g)));
}

const attended = (cs: ConcertRec[]) => cs.filter((c) => !c.cancelled);

function sawAll(cs: ConcertRec[], names: string[]): boolean {
  return names.every((n) => sawAny(cs, [n]));
}
const d = (c: ConcertRec) => new Date(c.dateDisplay);
const validDates = (cs: ConcertRec[]) =>
  attended(cs).map((c) => d(c)).filter((x) => !isNaN(+x));
function km(a: ConcertRec, b: ConcertRec): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const uniqueCount = (cs: ConcertRec[]) =>
  new Set(attended(cs).map((c) => `${c.venue.toLowerCase()}|${c.dateDisplay}`)).size;
const mediaCount = (c: ConcertRec) => (c.media?.length ?? 0) + (c.photosData?.length ?? 0);

const FEST_RE = /fest|lolla|coachella|rolling loud|bonnaroo|dreamville|governors ball|acl|osheaga|wireless|summer smash|edc|electric daisy|flog gnaw|glastonbury|made in america|broccoli city|one musicfest|reading|leeds|sxsw/i;
const atFest = (c: ConcertRec, re: RegExp) => re.test(`${c.venue} ${c.tour}`);
const festCount = (cs: ConcertRec[]) => attended(cs).filter((c) => atFest(c, FEST_RE)).length;

// more scenes, straight from the trenches
const DRAIN = ["Bladee", "Yung Lean", "Ecco2k", "Thaiboy Digital"];
const G59 = ["$uicideboy$", "Suicideboys", "Germ", "Night Lovell", "Pouya", "Ramirez"];
/** GigWise's 60 icons of 2000s R&B (minus one obvious omission). */
const R2K = [
  "Beyoncé", "Usher", "Alicia Keys", "Mary J. Blige", "Ne-Yo", "Mariah Carey",
  "Chris Brown", "Rihanna", "Ashanti", "Ciara", "Aaliyah", "John Legend",
  "Erykah Badu", "Jennifer Hudson", "Fantasia", "Keyshia Cole", "Brandy",
  "Monica", "Trey Songz", "Jaheim", "Ginuwine", "Destiny's Child", "Toni Braxton",
  "Mario", "Maxwell", "Joss Stone", "Amerie", "Mario Winans", "Angie Stone",
  "Joe", "Kelly Rowland", "Robin Thicke", "Tyrese", "Jill Scott", "Musiq Soulchild",
  "Anthony Hamilton", "Faith Evans", "Teairra Mari", "Omarion", "Tank",
  "Lyfe Jennings", "Avant", "Kelis", "LeToya Luckett", "Lloyd", "Mya",
  "Bobby Valentino", "Bobby V", "Craig David", "Keri Hilson", "B2K", "112",
  "Dave Hollister", "The-Dream", "D'Angelo", "T-Pain", "Teedra Moses",
  "Floetry", "Jamie Foxx", "Janet Jackson",
];

/** ØWay — the collective, whole roster. */
const OWAY = [
  "Tezzus", "diamond*", "ShawtyRokk", "10kdunkin", "Lil Righteous",
  "Southsidesilhouette", "Reezy X", "Lilkixkdor", "billi0n", "EA TJ",
  "Yung Fazo", "Pz'",
];

const DANCEHALL = ["Popcaan", "Alkaline", "Vybz Kartel", "Sean Paul", "Beenie Man", "Bounty Killer", "Shenseea", "Spice", "Skillibeng", "Dexta Daps", "Masicka", "Buju Banton"];
const COUNTRY = ["Morgan Wallen", "Luke Combs", "Zach Bryan", "Chris Stapleton", "Kacey Musgraves", "Lainey Wilson", "Jelly Roll", "Shaboozey", "Tyler Childers", "Carrie Underwood", "Dolly Parton", "George Strait"];
const AFROBEATS = ["Burna Boy", "Wizkid", "Davido", "Rema", "Asake", "Tems", "Ayra Starr", "Omah Lay", "Fireboy DML"];
const LATIN = ["Bad Bunny", "J Balvin", "Karol G", "Feid", "Rauw Alejandro", "Peso Pluma", "Daddy Yankee", "Ozuna"];
const KPOP = ["BTS", "Blackpink", "Stray Kids", "TWICE", "NewJeans", "Seventeen", "ATEEZ", "LE SSERAFIM"];
const HEAVY = ["Slipknot", "System of a Down", "Deftones", "Turnstile", "Korn", "Rage Against the Machine"];
const EDM = ["Skrillex", "Calvin Harris", "Fred again..", "Tiësto", "David Guetta", "Marshmello", "ISOxo", "Zedd"];

/** Guests who aren't rappers — the "wait, THAT guy?" tier. */
const NON_MUSICIANS = [
  "LeBron James", "Shaquille O'Neal", "Kevin Durant", "Stephen Curry", "Dwyane Wade",
  "Michael Jordan", "Serena Williams", "Odell Beckham Jr.", "Jonah Hill", "Adam Sandler",
  "Kevin Hart", "Dave Chappelle", "Jerry Seinfeld", "Steve-O", "Mike Tyson",
  "Conor McGregor", "Tom Brady", "Neymar", "Ronaldinho",
];

const DRILL = ["Chief Keef", "Lil Durk", "King Von", "G Herbo", "Polo G", "Fredo Santana", "Lil Reese"];

/* helpers for the moments + travel badges */
const hasMoment = (cs: ConcertRec[], id: string) =>
  attended(cs).some((c) => (c.moments ?? []).includes(id));
const momentCount = (cs: ConcertRec[], id: string) =>
  attended(cs).filter((c) => (c.moments ?? []).includes(id)).length;

const continents = (cs: ConcertRec[]) =>
  new Set(attended(cs).map((c) => continentOf(c.country)).filter(Boolean) as string[]);

/** Where you go out most — used as "home" for the travel badges. */
function homeCity(cs: ConcertRec[]): ConcertRec | null {
  const counts = new Map<string, { n: number; c: ConcertRec }>();
  for (const c of attended(cs)) {
    if (c.lat == null) continue;
    const k = c.city.toLowerCase();
    const cur = counts.get(k);
    counts.set(k, { n: (cur?.n ?? 0) + 1, c: cur?.c ?? c });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.c ?? null;
}

const MILES = 0.621371;

function readLocal(key: string): string | null {
  try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}

/** Artist birthdays, warmed in the background from MusicBrainz. */
function artistBorn(name: string): string | null {
  try {
    const raw = readLocal("heard.artistfacts.v1");
    if (!raw) return null;
    return JSON.parse(raw)[name.toLowerCase()]?.born ?? null;
  } catch { return null; }
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  pts: number;
  test: (cs: ConcertRec[]) => boolean;
}

const songs = (cs: ConcertRec[]) => attended(cs).reduce((s, c) => s + c.setlist.length, 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", icon: "🎟️", name: "First Memory", desc: "Log your first concert", pts: 10,
    test: (cs) => attended(cs).length >= 1 },
  { id: "shows5", icon: "🔥", name: "Regular", desc: "5 shows in the archive", pts: 15,
    test: (cs) => attended(cs).length >= 5 },
  { id: "shows10", icon: "🎪", name: "Show Hound", desc: "10 shows in the archive", pts: 25,
    test: (cs) => attended(cs).length >= 10 },
  { id: "shows25", icon: "👑", name: "Live Head", desc: "25 shows in the archive", pts: 50,
    test: (cs) => attended(cs).length >= 25 },
  { id: "shows50", icon: "🏆", name: "Certified Legend", desc: "50 shows in the archive", pts: 100,
    test: (cs) => attended(cs).length >= 50 },
  { id: "cities5", icon: "🧭", name: "Road Tripper", desc: "Shows in 5 different cities", pts: 20,
    test: (cs) => new Set(attended(cs).map((c) => c.city)).size >= 5 },
  { id: "cities10", icon: "🌍", name: "Touring Fan", desc: "Shows in 10 different cities", pts: 40,
    test: (cs) => new Set(attended(cs).map((c) => c.city)).size >= 10 },
  { id: "songs100", icon: "🎧", name: "Century Club", desc: "100 songs heard live", pts: 20,
    test: (cs) => songs(cs) >= 100 },
  { id: "songs500", icon: "💿", name: "Human Jukebox", desc: "500 songs heard live", pts: 60,
    test: (cs) => songs(cs) >= 500 },
  { id: "superfan", icon: "💘", name: "Superfan", desc: "Same artist 3+ times", pts: 25,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) counts.set(c.artist, (counts.get(c.artist) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 3);
    } },
  { id: "fivestar", icon: "⭐", name: "Perfect Night", desc: "Rate a show 5 stars", pts: 10,
    test: (cs) => attended(cs).some((c) => c.rating === 5) },
  { id: "documented", icon: "📸", name: "Documented", desc: "Add a photo or video", pts: 15,
    test: (cs) => cs.some((c) => (c.media?.length ?? 0) + (c.photosData?.length ?? 0) > 0) },
  { id: "festival", icon: "🎡", name: "Festival Season", desc: "Attend a festival", pts: 20,
    test: (cs) => attended(cs).some((c) =>
      /fest|lolla|coachella|rolling loud|bonnaroo|dreamville|governors ball|acl|osheaga|wireless/i
        .test(`${c.venue} ${c.tour}`)) },
  { id: "legend", icon: "🐐", name: "Seen a Legend", desc: "Catch a must-see act live", pts: 30,
    test: (cs) => attended(cs).some((c) =>
      splitArtists(c.artist).some((a) => LEGENDS.some((l) => norm(l) === norm(a)))) },
  { id: "unheard", icon: "🤫", name: "You Had To Be There", desc: "Hear an unreleased song live", pts: 25,
    test: () => typeof window !== "undefined" && localStorage.getItem("heard.ach.unreleased") === "1" },
  { id: "opium", icon: "🩸", name: "Opium Aligned", desc: "Catch an Opium act live", pts: 25,
    test: (cs) => sawAny(cs, OPIUM) },
  { id: "ysl", icon: "🐍", name: "Slime Season", desc: "Catch a YSL act live", pts: 25,
    test: (cs) => sawAny(cs, YSL) },
  { id: "rage", icon: "⚡", name: "Rager", desc: "Survive a rage set", pts: 20,
    test: (cs) => sawAny(cs, RAGE) || hasGenre(cs, /rage/i) },
  { id: "underground", icon: "🕳️", name: "Underground Head", desc: "Pull up for the underground", pts: 25,
    test: (cs) => sawAny(cs, UNDERGROUND) || hasGenre(cs, /plugg|pluggnb|hexd|underground/i) },
  { id: "rare", icon: "🦄", name: "Rare Sighting", desc: "See an artist who almost never performs", pts: 40,
    test: (cs) => sawAny(cs, RARE) },
  { id: "throwback", icon: "📼", name: "Throwback", desc: "A show from before 2016 in the archive", pts: 15,
    test: (cs) => cs.some((c) => !c.cancelled && c.year < 2016) },
  { id: "decades", icon: "🕰️", name: "Decade Collector", desc: "Shows in 2+ different decades", pts: 25,
    test: (cs) => new Set(cs.filter((c) => !c.cancelled).map((c) => Math.floor(c.year / 10))).size >= 2 },
  // --- combos & easter eggs ---
  { id: "beef", icon: "⚔️", name: "Heard Both Sides", desc: "See Drake AND Kendrick live", pts: 40,
    test: (cs) => sawAll(cs, ["Drake", "Kendrick Lamar"]) },
  { id: "big3", icon: "👑", name: "The Big 3", desc: "Drake, Kendrick, and J. Cole — all seen live", pts: 60,
    test: (cs) => sawAll(cs, ["Drake", "Kendrick Lamar", "J. Cole"]) },
  { id: "carters", icon: "🐝", name: "The Carters", desc: "See Beyoncé and Jay-Z live", pts: 30,
    test: (cs) => sawAll(cs, ["Beyoncé", "Jay-Z"]) },
  { id: "b2b", icon: "🔁", name: "Back to Back", desc: "Shows on consecutive days", pts: 25,
    test: (cs) => {
      const ds = validDates(cs).map((x) => Math.floor(+x / 86400000)).sort((a, b) => a - b);
      return ds.some((x, i) => i > 0 && x - ds[i - 1] === 1);
    } },
  { id: "doubleheader", icon: "🌙", name: "Doubleheader", desc: "Two shows in one day", pts: 30,
    test: (cs) => {
      const ds = validDates(cs).map((x) => x.toDateString());
      return new Set(ds).size < ds.length;
    } },
  { id: "heavyrotation", icon: "🗓️", name: "Heavy Rotation", desc: "3 shows in one calendar month", pts: 25,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const x of validDates(cs)) {
        const k = `${x.getFullYear()}-${x.getMonth()}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      return [...counts.values()].some((n) => n >= 3);
    } },
  { id: "hometown", icon: "🏠", name: "Hometown Hero", desc: "3+ shows in the same city", pts: 20,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) counts.set(c.city, (counts.get(c.city) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 3);
    } },
  { id: "flyer", icon: "✈️", name: "Frequent Flyer", desc: "Two venues 3,000+ km apart", pts: 40,
    test: (cs) => {
      const a = attended(cs).filter((c) => c.lat != null);
      return a.some((x, i) => a.some((y, j) => j > i && km(x, y) >= 3000));
    } },
  { id: "encore", icon: "🔂", name: "Ran It Back", desc: "Same artist, same tour, twice", pts: 25,
    test: (cs) => {
      const seen = new Map<string, number>();
      for (const c of attended(cs)) {
        const k = `${c.artist}::${c.tour}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      return [...seen.values()].some((n) => n >= 2);
    } },
  { id: "surprise", icon: "🎁", name: "Surprise Guest", desc: "Someone got brought out at your show", pts: 25,
    test: (cs) => attended(cs).some((c) => (c.guests?.length ?? 0) > 0) },
  { id: "guestlist", icon: "📋", name: "Guest List", desc: "5 different surprise guests across your shows", pts: 40,
    test: (cs) => new Set(attended(cs).flatMap((c) => (c.guests ?? []).map(norm))).size >= 5 },
  { id: "stacked", icon: "🎡", name: "Stacked Night", desc: "3 guests brought out at one show", pts: 35,
    test: (cs) => attended(cs).some((c) => (c.guests?.length ?? 0) >= 3) },
  { id: "notarapper", icon: "🏀", name: "He Doesn't Even Rap", desc: "A non-musician got brought out", pts: 45,
    test: (cs) => attended(cs).some((c) =>
      (c.guests ?? []).some((g) => NON_MUSICIANS.some((n) => norm(n) === norm(g)))) },
  { id: "cosign", icon: "🤝", name: "Co-Sign", desc: "A multi-artist bill in the archive", pts: 10,
    test: (cs) => attended(cs).some((c) => (c.artists?.length ?? 0) >= 2) },
  // --- venues ---
  { id: "stadium", icon: "🏟️", name: "Stadium Status", desc: "A stadium show", pts: 15,
    test: (cs) => attended(cs).some((c) => /stadium|coliseum|bowl|field\b/i.test(c.venue)) },
  { id: "intimate", icon: "🕯️", name: "Intimate Setting", desc: "A club, bar, or hall show", pts: 15,
    test: (cs) => attended(cs).some((c) => /\b(club|bar|hall|lounge|room|basement|theatre|theater)\b/i.test(c.venue)) },
  // --- money ---
  { id: "bigspender", icon: "💸", name: "Big Spender", desc: "$1,000 total on tickets", pts: 25,
    test: (cs) => attended(cs).reduce((s, c) => s + c.price, 0) >= 1000 },
  { id: "scalped", icon: "🎫", name: "Resale Casualty", desc: "$300+ on a single ticket", pts: 20,
    test: (cs) => attended(cs).some((c) => c.price >= 300) },
  { id: "freebie", icon: "🆓", name: "On the List", desc: "Log a $0 show", pts: 10,
    test: (cs) => attended(cs).some((c) => c.price === 0 && c.rating > 0) },
  // --- documentation ---
  { id: "memoirist", icon: "✍️", name: "Memoirist", desc: "Write 5 journal entries", pts: 20,
    test: (cs) => cs.filter((c) => (c.notes ?? "").trim().length > 0).length >= 5 },
  { id: "cameraman", icon: "🎥", name: "Cameraman", desc: "Save 5 videos", pts: 20,
    test: (cs) => cs.reduce((s, c) => s + (c.media?.filter((m) => m.type === "video").length ?? 0), 0) >= 5 },
  { id: "shutterbug", icon: "📷", name: "Shutterbug", desc: "Save 25 photos", pts: 25,
    test: (cs) => cs.reduce((s, c) => s + (c.media?.filter((m) => m.type === "image").length ?? 0) + (c.photosData?.length ?? 0), 0) >= 25 },
  { id: "curator", icon: "🗂️", name: "Curator", desc: "5 shows fully documented — stars, price, notes, media", pts: 40,
    test: (cs) => attended(cs).filter((c) =>
      c.rating > 0 && c.price > 0 && (c.notes ?? "").trim().length > 0 && mediaCount(c) > 0).length >= 5 },
  // --- taste ---
  { id: "genrebender", icon: "🌈", name: "Genre Bender", desc: "3+ genres in the archive", pts: 20,
    test: (cs) => new Set(attended(cs).flatMap((c) => c.genres ?? [])).size >= 3 },
  { id: "manifested", icon: "🔮", name: "Manifested", desc: "A future show on the calendar", pts: 10,
    test: (cs) => attended(cs).some((c) => +d(c) > Date.now()) },
  // --- calendar eggs ---
  { id: "spooky", icon: "🎃", name: "Spooky Season", desc: "A show on Halloween", pts: 20,
    test: (cs) => validDates(cs).some((x) => x.getMonth() === 9 && x.getDate() === 31) },
  { id: "nye", icon: "🎆", name: "New Year, New Show", desc: "A show on Dec 31 or Jan 1", pts: 25,
    test: (cs) => validDates(cs).some((x) =>
      (x.getMonth() === 11 && x.getDate() === 31) || (x.getMonth() === 0 && x.getDate() === 1)) },
  { id: "datenight", icon: "💘", name: "Date Night", desc: "A show on Valentine's Day", pts: 15,
    test: (cs) => validDates(cs).some((x) => x.getMonth() === 1 && x.getDate() === 14) },
  { id: "schoolnight", icon: "🌃", name: "School Night", desc: "A Monday–Thursday show", pts: 10,
    test: (cs) => validDates(cs).some((x) => x.getDay() >= 1 && x.getDay() <= 4) },
  // --- logging habits ---
  { id: "fresh", icon: "⚡", name: "Same-Week Logger", desc: "Log a show within 3 days of it happening", pts: 10,
    test: (cs) => attended(cs).some((c) => {
      const gap = (c.updatedAt ?? 0) - +d(c);
      return gap >= 0 && gap < 3 * 86400000;
    }) },
  { id: "historian", icon: "🏺", name: "Historian", desc: "Log a show 5+ years after it happened", pts: 15,
    test: (cs) => attended(cs).some((c) => {
      const gap = (c.updatedAt ?? 0) - +d(c);
      return gap > 5 * 365 * 86400000;
    }) },
  // --- festival passport ---
  { id: "summersmash", icon: "🍋", name: "Summer Smash", desc: "Attend the Lyrical Lemonade festival", pts: 30,
    test: (cs) => attended(cs).some((c) => atFest(c, /summer smash|lyrical lemonade|seatgeek stadium/i)) },
  { id: "rollingloud", icon: "🌴", name: "Loud Pack", desc: "Attend Rolling Loud", pts: 25,
    test: (cs) => attended(cs).some((c) => atFest(c, /rolling loud/i)) },
  { id: "edc", icon: "🎆", name: "Under the Electric Sky", desc: "Attend EDC (Orlando, Vegas, anywhere)", pts: 25,
    test: (cs) => attended(cs).some((c) => atFest(c, /\bedc\b|electric daisy/i)) },
  { id: "coachella", icon: "🌵", name: "Desert Pilgrimage", desc: "Attend Coachella", pts: 25,
    test: (cs) => attended(cs).some((c) => atFest(c, /coachella/i)) },
  { id: "floggnaw", icon: "🧸", name: "Gnawed", desc: "Attend Camp Flog Gnaw", pts: 30,
    test: (cs) => attended(cs).some((c) => atFest(c, /flog gnaw/i)) },
  { id: "dreamvillefest", icon: "🌇", name: "Dreamville", desc: "Attend Dreamville Festival", pts: 25,
    test: (cs) => attended(cs).some((c) => atFest(c, /dreamville/i)) },
  { id: "glasto", icon: "🌾", name: "Worthy Farm", desc: "Attend Glastonbury", pts: 40,
    test: (cs) => attended(cs).some((c) => atFest(c, /glastonbury/i)) },
  { id: "festsummer", icon: "☀️", name: "Festival Summer", desc: "2 festivals in one year", pts: 30,
    test: (cs) => {
      const byYear = new Map<number, number>();
      for (const c of attended(cs)) if (atFest(c, FEST_RE)) byYear.set(c.year, (byYear.get(c.year) ?? 0) + 1);
      return [...byYear.values()].some((n) => n >= 2);
    } },
  { id: "festvet", icon: "🎪", name: "Fest Vet", desc: "5 lifetime festivals", pts: 50,
    test: (cs) => festCount(cs) >= 5 },
  // --- more scenes ---
  { id: "drain", icon: "🥀", name: "Drained", desc: "Catch Drain Gang live", pts: 30,
    test: (cs) => sawAny(cs, DRAIN) },
  { id: "g59", icon: "☠️", name: "Grey Day", desc: "Catch $uicideboy$ or the G59 orbit", pts: 25,
    test: (cs) => sawAny(cs, G59) },
  { id: "drill", icon: "🏙️", name: "From the Go", desc: "Catch a Chicago drill legend live", pts: 25,
    test: (cs) => sawAny(cs, DRILL) },
  { id: "r2k", icon: "💽", name: "R2K Certified", desc: "See a 2000s R&B icon live", pts: 25,
    test: (cs) => sawAny(cs, R2K) },
  { id: "dancehall", icon: "🇯🇲", name: "Yard Vibes", desc: "Catch a dancehall king or queen live", pts: 25,
    test: (cs) => sawAny(cs, DANCEHALL) || hasGenre(cs, /dancehall|reggae/i) },
  { id: "country", icon: "🤠", name: "Boots On", desc: "Catch a country show", pts: 20,
    test: (cs) => sawAny(cs, COUNTRY) || hasGenre(cs, /country/i) },
  { id: "afrobeats", icon: "🌍", name: "Afrobeats", desc: "Catch an Afrobeats star live", pts: 25,
    test: (cs) => sawAny(cs, AFROBEATS) || hasGenre(cs, /afrobeats|afropop|afro/i) },
  { id: "latin", icon: "🔥", name: "Perreo", desc: "Catch a reggaeton or Latin star live", pts: 25,
    test: (cs) => sawAny(cs, LATIN) || hasGenre(cs, /reggaeton|latin|corridos/i) },
  { id: "kpop", icon: "🫰", name: "Bias Confirmed", desc: "Catch a K-pop act live", pts: 25,
    test: (cs) => sawAny(cs, KPOP) || hasGenre(cs, /k-pop/i) },
  { id: "heavy", icon: "🤘", name: "Wall of Death", desc: "Survive a metal or hardcore show", pts: 25,
    test: (cs) => sawAny(cs, HEAVY) || hasGenre(cs, /metal|hardcore|punk/i) },
  { id: "edm", icon: "🎧", name: "Main Stage Energy", desc: "Catch an EDM set", pts: 20,
    test: (cs) => sawAny(cs, EDM) || hasGenre(cs, /\bedm\b|house|dubstep|techno|electronic/i) },
  { id: "oway", icon: "⭕", name: "ØWay", desc: "Pull up for the ØWay collective", pts: 25,
    test: (cs) => sawAny(cs, OWAY) },
  { id: "msg", icon: "🗽", name: "The Garden", desc: "A show at Madison Square Garden", pts: 30,
    test: (cs) => attended(cs).some((c) => /madison square garden|\bmsg\b/i.test(c.venue)) },
  { id: "redrocks", icon: "🏔️", name: "Red Rocks", desc: "A show at Red Rocks Amphitheatre", pts: 30,
    test: (cs) => attended(cs).some((c) => /red rocks/i.test(c.venue)) },
  { id: "hollywoodbowl", icon: "🎻", name: "The Bowl", desc: "A show at the Hollywood Bowl", pts: 25,
    test: (cs) => attended(cs).some((c) => /hollywood bowl/i.test(c.venue)) },
  { id: "theo2", icon: "🇬🇧", name: "The O2", desc: "A show at The O2 in London", pts: 25,
    test: (cs) => attended(cs).some((c) => /\bo2\b/i.test(c.venue) && /london/i.test(c.city)) },
  { id: "wembley", icon: "🏟️", name: "Wembley", desc: "A show at Wembley", pts: 30,
    test: (cs) => attended(cs).some((c) => /wembley/i.test(c.venue)) },
  // --- rare tier ---
  { id: "centurion", icon: "💯", name: "Centurion", desc: "100 shows in the archive", pts: 150,
    test: (cs) => attended(cs).length >= 100 },
  { id: "encyclopedia", icon: "📚", name: "Encyclopedia", desc: "1,000 songs heard live", pts: 100,
    test: (cs) => songs(cs) >= 1000 },
  { id: "continental", icon: "🌐", name: "Continental", desc: "Venues 8,000+ km apart", pts: 60,
    test: (cs) => {
      const a = attended(cs).filter((c) => c.lat != null);
      return a.some((x, i) => a.some((y, j) => j > i && km(x, y) >= 8000));
    } },
  { id: "grew", icon: "🌱", name: "Watched Them Grow", desc: "Same artist, 3+ years apart", pts: 30,
    test: (cs) => {
      const years = new Map<string, number[]>();
      for (const c of attended(cs)) years.set(c.artist, [...(years.get(c.artist) ?? []), c.year]);
      return [...years.values()].some((ys) => Math.max(...ys) - Math.min(...ys) >= 3);
    } },
  { id: "regulars", icon: "🪑", name: "Regulars Booth", desc: "5 shows at the same venue", pts: 30,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) counts.set(c.venue, (counts.get(c.venue) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 5);
    } },
  { id: "tradition", icon: "🎂", name: "Tradition", desc: "Shows on the same date, different years", pts: 25,
    test: (cs) => {
      const keys = validDates(cs).map((x) => `${x.getMonth()}-${x.getDate()}`);
      const ys = new Map<string, Set<number>>();
      validDates(cs).forEach((x) => {
        const k = `${x.getMonth()}-${x.getDate()}`;
        ys.set(k, (ys.get(k) ?? new Set()).add(x.getFullYear()));
      });
      return [...ys.values()].some((set) => set.size >= 2);
    } },
  { id: "hotstreak", icon: "🔥", name: "Hot Streak", desc: "Shows in 3 consecutive months", pts: 30,
    test: (cs) => {
      const months = [...new Set(validDates(cs).map((x) => x.getFullYear() * 12 + x.getMonth()))].sort((a, b) => a - b);
      return months.some((m, i) => i >= 2 && months[i - 1] === m - 1 && months[i - 2] === m - 2);
    } },
  { id: "marathon", icon: "🏃", name: "Marathon Set", desc: "A show with 25+ songs", pts: 20,
    test: (cs) => attended(cs).some((c) => c.setlist.length >= 25) },
  { id: "shortsweet", icon: "⏱️", name: "Short & Sweet", desc: "A show with 5 or fewer songs", pts: 10,
    test: (cs) => attended(cs).some((c) => c.setlist.length > 0 && c.setlist.length <= 5) },
  { id: "winter", icon: "🧊", name: "Winter Warrior", desc: "A Dec–Feb show", pts: 10,
    test: (cs) => validDates(cs).some((x) => [11, 0, 1].includes(x.getMonth())) },
  { id: "toughcrowd", icon: "🧾", name: "Tough Crowd", desc: "Rate a show 2 stars or less", pts: 15,
    test: (cs) => attended(cs).some((c) => c.rating > 0 && c.rating <= 2) },
  { id: "fivestargeneral", icon: "🎖️", name: "Five Star General", desc: "Ten 5-star shows", pts: 30,
    test: (cs) => attended(cs).filter((c) => c.rating === 5).length >= 10 },
  { id: "omnivore", icon: "🎭", name: "Omnivore", desc: "5+ genres in the archive", pts: 40,
    test: (cs) => new Set(attended(cs).flatMap((c) => c.genres ?? [])).size >= 5 },
  { id: "halftime", icon: "🏈", name: "Halftime Show", desc: "Witness a Super Bowl or World Cup halftime show", pts: 60,
    test: (cs) => attended(cs).some((c) => /halftime|super ?bowl|world cup/i.test(`${c.tour ?? ""} ${c.venue}`)) },
  { id: "bigstage", icon: "🌐", name: "Global Stage", desc: "A show watched by the whole planet — halftime, Grammys, Glastonbury Pyramid", pts: 50,
    test: (cs) => attended(cs).some((c) => /halftime|super ?bowl|world cup|grammy|pyramid stage|olympic/i.test(`${c.tour ?? ""} ${c.venue}`)) },
  { id: "opener", icon: "🚪", name: "Early Arrival", desc: "See an opener who later headlined their own tour", pts: 25,
    test: (cs) => {
      const byArtist = new Map<string, ConcertRec[]>();
      for (const c of attended(cs)) for (const a of splitArtists(c.artist)) {
        byArtist.set(norm(a), [...(byArtist.get(norm(a)) ?? []), c]);
      }
      return [...byArtist.values()].some((list) => new Set(list.map((c) => c.tour)).size >= 2);
    } },
  { id: "sober", icon: "📿", name: "Front Row Focus", desc: "A show with a journal entry over 200 characters", pts: 20,
    test: (cs) => cs.some((c) => (c.notes ?? "").trim().length > 200) },
  { id: "arena", icon: "🏛️", name: "Arena Tour", desc: "5 arena shows", pts: 25,
    test: (cs) => attended(cs).filter((c) => /arena|center|centre|forum/i.test(c.venue)).length >= 5 },
  { id: "globetrotter", icon: "🛫", name: "Globetrotter", desc: "Shows in 3+ countries", pts: 50,
    test: (cs) => new Set(attended(cs).map((c) => c.country).filter(Boolean)).size >= 3 },
  { id: "weekender", icon: "🌅", name: "Full Weekend", desc: "Shows on a Fri, Sat, and Sun", pts: 25,
    test: (cs) => {
      const days = new Set(validDates(cs).map((x) => x.getDay()));
      return days.has(5) && days.has(6) && days.has(0);
    } },
  { id: "deepcut", icon: "🔍", name: "Deep Cut", desc: "Hear a song only once across all your shows", pts: 15,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) for (const s of c.setlist) counts.set(norm(s), (counts.get(norm(s)) ?? 0) + 1);
      return counts.size >= 20 && [...counts.values()].some((n) => n === 1);
    } },
  { id: "anthem", icon: "📣", name: "Anthem", desc: "Hear the same song at 5 different shows", pts: 25,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) for (const s of new Set(c.setlist.map(norm))) counts.set(s, (counts.get(s) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 5);
    } },
  /* ── the night itself (your own tags) ─────────────────────────────── */
  { id: "frontrow", icon: "🤝", name: "Barrier Buddy", desc: "Make it to the barricade", pts: 25,
    test: (cs) => hasMoment(cs, "frontrow") },
  { id: "pit", icon: "🌀", name: "Pit Survivor", desc: "Go in the mosh pit", pts: 20,
    test: (cs) => hasMoment(cs, "pit") },
  { id: "crowdsurf", icon: "🌊", name: "Crowd Surfer", desc: "Get carried by the crowd", pts: 25,
    test: (cs) => hasMoment(cs, "crowdsurf") },
  { id: "handtouch", icon: "🙌", name: "Hands Up", desc: "The artist touched your hand", pts: 30,
    test: (cs) => hasMoment(cs, "handtouch") },
  { id: "miccheck", icon: "🎙️", name: "Mic Check", desc: "Sing into the artist's mic", pts: 40,
    test: (cs) => hasMoment(cs, "mic") },
  { id: "everyword", icon: "🧠", name: "Lyric Encyclopedia", desc: "Know every word, all night", pts: 20,
    test: (cs) => hasMoment(cs, "everyword") },
  { id: "crew", icon: "🫂", name: "Concert Crew", desc: "10 shows with friends", pts: 25,
    test: (cs) => momentCount(cs, "friends") >= 10 },
  { id: "sameday", icon: "📍", name: "Wrong Place, Right Time", desc: "Tickets the same day as the show", pts: 20,
    test: (cs) => hasMoment(cs, "lastminute") },
  { id: "upgraded", icon: "🎲", name: "Lucky Break", desc: "Get upgraded seats", pts: 30,
    test: (cs) => hasMoment(cs, "upgraded") },
  { id: "sunrise", icon: "🌅", name: "Sunrise", desc: "Leave the venue after midnight", pts: 15,
    test: (cs) => hasMoment(cs, "aftermidnight") },
  { id: "setlistchanged", icon: "⚠️", name: "Setlist Changed", desc: "They switched it up mid-show", pts: 25,
    test: (cs) => hasMoment(cs, "setlistchanged") },
  { id: "raindelay", icon: "🌧️", name: "Rain Delay", desc: "Weather interrupted the show", pts: 30,
    test: (cs) => hasMoment(cs, "raindelay") },
  { id: "showstopped", icon: "🚨", name: "Show Stopped", desc: "The show was paused", pts: 35,
    test: (cs) => hasMoment(cs, "stopped") },
  { id: "fullalbum", icon: "🎼", name: "No Skips", desc: "An album played front to back", pts: 75,
    test: (cs) => hasMoment(cs, "fullalbum") },
  { id: "albumanniversary", icon: "💿", name: "Album Anniversary", desc: "An anniversary performance", pts: 25,
    test: (cs) => hasMoment(cs, "anniversary") },
  { id: "demotape", icon: "📼", name: "Demo Tape", desc: "Hear a demo or unreleased cut", pts: 20,
    test: (cs) => hasMoment(cs, "demo") },
  { id: "cried", icon: "😭", name: "Got Me", desc: "Cried at a show", pts: 10,
    test: (cs) => hasMoment(cs, "cried") },
  { id: "fellinlove", icon: "❤️", name: "Fell in Love", desc: "Went with someone you later dated", pts: 15,
    test: (cs) => hasMoment(cs, "fellinlove") },
  { id: "characterdev", icon: "💔", name: "Character Development", desc: "Went with someone you're no longer with", pts: 15,
    test: (cs) => hasMoment(cs, "characterdev") },
  { id: "film", icon: "📸", name: "Disposable", desc: "Shoot a show on film", pts: 20,
    test: (cs) => hasMoment(cs, "film") },

  /* ── tours ────────────────────────────────────────────────────────── */
  { id: "openingnight", icon: "🎟️", name: "Opening Night", desc: "Be there for a tour's first show", pts: 30,
    test: (cs) => attended(cs).some((c) => c.tourPosition?.index === 1) },
  { id: "finalbow", icon: "🏁", name: "Final Bow", desc: "Be there for a tour's last show", pts: 30,
    test: (cs) => attended(cs).some((c) => c.tourPosition && c.tourPosition.index === c.tourPosition.total) },
  { id: "nevermissed", icon: "🗓️", name: "Never Missed a Tour", desc: "See one artist on 5 different tours", pts: 100,
    test: (cs) => {
      const tours = new Map<string, Set<string>>();
      for (const c of attended(cs)) for (const a of splitArtists(c.artist)) {
        if (!c.tour || c.tour === "Live") continue;
        tours.set(norm(a), (tours.get(norm(a)) ?? new Set()).add(norm(c.tour)));
      }
      return [...tours.values()].some((set) => set.size >= 5);
    } },
  { id: "rideordie", icon: "👑", name: "Ride or Die", desc: "See the same artist 10 times", pts: 75,
    test: (cs) => {
      const counts = new Map<string, number>();
      for (const c of attended(cs)) for (const a of splitArtists(c.artist)) {
        counts.set(norm(a), (counts.get(norm(a)) ?? 0) + 1);
      }
      return [...counts.values()].some((n) => n >= 10);
    } },
  { id: "tourcompletionist", icon: "📅", name: "Tour Completionist", desc: "See every opener on one tour", pts: 40,
    test: (cs) => attended(cs).some((c) => {
      const openers = (c.openers ?? []).map(norm).filter(Boolean);
      if (openers.length < 2) return false;
      const billed = new Set(splitArtists(c.artist).map(norm));
      return openers.every((o) => billed.has(o));
    }) },
  { id: "encore3", icon: "🎤", name: "Encore", desc: "Hear an encore of 3+ songs", pts: 20,
    test: (cs) => attended(cs).some((c) => (c.encoreCount ?? 0) >= 3) },

  /* ── travel ───────────────────────────────────────────────────────── */
  { id: "worldtour", icon: "🌍", name: "World Tour", desc: "Shows on 4 continents", pts: 150,
    test: (cs) => continents(cs).size >= 4 },
  { id: "aroundtheworld", icon: "🌌", name: "Around the World", desc: "Shows on every inhabited continent", pts: 500,
    test: (cs) => continents(cs).size >= 6 },
  { id: "northamerican", icon: "🌎", name: "North American Tour", desc: "Shows in the US, Canada and Mexico", pts: 40,
    test: (cs) => ["US", "CA", "MX"].every((cc) => attended(cs).some((c) => c.country === cc)) },
  { id: "coasttocoast", icon: "🗺️", name: "Coast to Coast", desc: "Shows on both US coasts", pts: 30,
    test: (cs) => {
      const us = attended(cs).filter((c) => c.country === "US" && c.lng != null);
      return us.some((c) => c.lng! < -115) && us.some((c) => c.lng! > -80);
    } },
  { id: "worththedrive", icon: "🛣️", name: "Worth the Drive", desc: "Travel 500+ miles for one show", pts: 25,
    test: (cs) => {
      const home = homeCity(cs);
      if (!home) return false;
      return attended(cs).some((c) => c.lat != null && km(home, c) * MILES >= 500);
    } },
  { id: "passport", icon: "✈️", name: "Passport Stamp", desc: "Fly to another country for a show", pts: 40,
    test: (cs) => {
      const home = homeCity(cs)?.country;
      if (!home) return hasMoment(cs, "flew");
      return attended(cs).some((c) => c.country && c.country !== home);
    } },

  /* ── the long game ────────────────────────────────────────────────── */
  { id: "archivist", icon: "📚", name: "Archivist", desc: "Log 100 shows from your past", pts: 50,
    test: (cs) => attended(cs).filter((c) => +new Date(c.dateDisplay) < Date.now()).length >= 100 },
  { id: "tripledigits", icon: "🏆", name: "Triple Digits", desc: "250 shows", pts: 250,
    test: (cs) => uniqueCount(cs) >= 250 },
  { id: "generational", icon: "⏳", name: "Generational Run", desc: "100 shows spanning 10+ years", pts: 100,
    test: (cs) => {
      const ys = attended(cs).map((c) => c.year).filter(Boolean);
      return attended(cs).length >= 100 && Math.max(...ys) - Math.min(...ys) >= 10;
    } },
  { id: "setlistmaster", icon: "🧩", name: "Setlist Master", desc: "1,000 different songs live", pts: 150,
    test: (cs) => new Set(attended(cs).flatMap((c) => c.setlist.map(norm))).size >= 1000 },
  { id: "timecapsule", icon: "⌛", name: "Time Capsule", desc: "A show exactly a year after another", pts: 20,
    test: (cs) => {
      const days = validDates(cs).map((d) => Math.round(+d / 86400000));
      return days.some((a) => days.some((b) => b - a === 365 || b - a === 366));
    } },
  { id: "storyteller", icon: "📖", name: "Storyteller", desc: "Write a 500-character journal entry", pts: 25,
    test: (cs) => cs.some((c) => (c.notes ?? "").trim().length >= 500) },
  { id: "cinematic", icon: "🎥", name: "Cinematic", desc: "Save a video a minute or longer", pts: 15,
    test: (cs) => cs.some((c) => (c.media ?? []).some((m) => (m.durationSec ?? 0) >= 60)) },
  { id: "everydetail", icon: "🕰️", name: "Every Detail", desc: "One show with rating, price, notes and media", pts: 30,
    test: (cs) => attended(cs).some((c) =>
      c.rating > 0 && c.price > 0 && (c.notes ?? "").trim().length > 0 && mediaCount(c) > 0) },
  { id: "perfectarchive", icon: "💯", name: "Perfect Archive", desc: "20 fully documented shows", pts: 75,
    test: (cs) => attended(cs).filter((c) =>
      c.rating > 0 && c.price > 0 && (c.notes ?? "").trim().length > 0 && mediaCount(c) > 0).length >= 20 },
  { id: "ticketcollector", icon: "🎫", name: "Ticket Collector", desc: "Scan 10 tickets", pts: 20,
    test: (cs) => cs.filter((c) => c.ticketScanned).length >= 10 },
  { id: "cancelled", icon: "❌", name: "So Close", desc: "A show you logged got cancelled", pts: 15,
    test: (cs) => cs.some((c) => c.cancelled) },

  /* ── birthdays ────────────────────────────────────────────────────── */
  { id: "birthdayshow", icon: "🎂", name: "Birthday Show", desc: "See a show on your birthday", pts: 20,
    test: (cs) => {
      const bday = readLocal("heard.birthday");
      if (!bday) return false;
      const [, m, d] = bday.split("-");
      return validDates(cs).some((x) =>
        x.getMonth() + 1 === Number(m) && x.getDate() === Number(d));
    } },
  { id: "birthdayperformer", icon: "🎁", name: "Birthday Performer", desc: "See an artist on THEIR birthday", pts: 30,
    test: (cs) => attended(cs).some((c) => {
      const show = new Date(c.dateDisplay);
      if (isNaN(+show)) return false;
      return splitArtists(c.artist).some((a) => {
        const born = artistBorn(a);
        if (!born) return false;
        const [, m, d] = born.split("-");
        return Number(m) === show.getMonth() + 1 && Number(d) === show.getDate();
      });
    }) },
  { id: "completionist", icon: "🏅", name: "Completionist", desc: "Unlock every other achievement", pts: 250,
    test: (cs) => {
      const others = ACHIEVEMENTS.filter((a) => a.id !== "completionist");
      return others.length > 0 && others.every((a) => { try { return a.test(cs); } catch { return false; } });
    } },
];

export function unlockUnreleasedAchievement() {
  try { localStorage.setItem("heard.ach.unreleased", "1"); } catch {}
}

/* ── why did this unlock? ─────────────────────────────────────────────── */

const ROSTERS: Record<string, string[]> = {
  legend: LEGENDS, rare: RARE, opium: OPIUM, ysl: YSL, rage: RAGE,
  underground: UNDERGROUND, drain: DRAIN, g59: G59, drill: DRILL,
  r2k: R2K, oway: OWAY, dancehall: DANCEHALL, country: COUNTRY,
  afrobeats: AFROBEATS, latin: LATIN, kpop: KPOP, heavy: HEAVY, edm: EDM,
};

/** The show that earned a roster badge: "Playboi Carti · Charlotte · Nov 14, 2025" */
function rosterEvidence(cs: ConcertRec[], roster: string[]): string | null {
  for (const c of attended(cs)) {
    for (const a of splitArtists(c.artist)) {
      const hit = roster.find((r) => norm(r) === norm(a));
      if (hit) return `${a} · ${c.city} · ${c.dateDisplay}`;
    }
  }
  return null;
}

const COUNTERS: Record<string, (cs: ConcertRec[]) => [number, number]> = {
  shows5: (cs) => [attended(cs).length, 5],
  shows10: (cs) => [attended(cs).length, 10],
  shows25: (cs) => [attended(cs).length, 25],
  shows50: (cs) => [attended(cs).length, 50],
  centurion: (cs) => [attended(cs).length, 100],
  cities5: (cs) => [new Set(attended(cs).map((c) => c.city)).size, 5],
  cities10: (cs) => [new Set(attended(cs).map((c) => c.city)).size, 10],
  songs100: (cs) => [songs(cs), 100],
  songs500: (cs) => [songs(cs), 500],
  encyclopedia: (cs) => [songs(cs), 1000],
  festvet: (cs) => [festCount(cs), 5],
  memoirist: (cs) => [cs.filter((c) => (c.notes ?? "").trim().length > 0).length, 5],
  cameraman: (cs) => [cs.reduce((n, c) => n + (c.media?.filter((m) => m.type === "video").length ?? 0), 0), 5],
  shutterbug: (cs) => [cs.reduce((n, c) => n + (c.media?.filter((m) => m.type === "image").length ?? 0) + (c.photosData?.length ?? 0), 0), 25],
  fivestargeneral: (cs) => [attended(cs).filter((c) => c.rating === 5).length, 10],
  guestlist: (cs) => [new Set(attended(cs).flatMap((c) => (c.guests ?? []).map(norm))).size, 5],
  bigspender: (cs) => [Math.round(attended(cs).reduce((n, c) => n + c.price, 0)), 1000],
  globetrotter: (cs) => [new Set(attended(cs).map((c) => c.country).filter(Boolean)).size, 3],
  omnivore: (cs) => [new Set(attended(cs).flatMap((c) => c.genres ?? [])).size, 5],
  genrebender: (cs) => [new Set(attended(cs).flatMap((c) => c.genres ?? [])).size, 3],
  completionist: (cs) => [ACHIEVEMENTS.filter((a) => a.id !== "completionist" && (() => { try { return a.test(cs); } catch { return false; } })()).length, ACHIEVEMENTS.length - 1],
};

/** One line explaining an unlocked badge, or progress toward a locked one. */
export function describe(a: Achievement, cs: ConcertRec[], unlocked: boolean): string | null {
  if (unlocked) {
    const roster = ROSTERS[a.id];
    if (roster) return rosterEvidence(cs, roster);

    const first = (pred: (c: ConcertRec) => boolean, fmt: (c: ConcertRec) => string) => {
      const c = attended(cs).find(pred);
      return c ? fmt(c) : null;
    };
    switch (a.id) {
      case "first": {
        const oldest = [...attended(cs)].sort((x, y) => +new Date(x.dateDisplay) - +new Date(y.dateDisplay))[0];
        return oldest ? `${oldest.artist} · ${oldest.dateDisplay}` : null;
      }
      case "fivestar": return first((c) => c.rating === 5, (c) => `${c.artist} · ${c.dateDisplay}`);
      case "festival": return first((c) => atFest(c, FEST_RE), (c) => `${c.tour || c.venue} · ${c.dateDisplay}`);
      case "stadium": return first((c) => /stadium|coliseum|bowl|field\b/i.test(c.venue), (c) => c.venue);
      case "intimate": return first((c) => /\b(club|bar|hall|lounge|room|basement|theatre|theater)\b/i.test(c.venue), (c) => c.venue);
      case "msg": case "redrocks": case "hollywoodbowl": case "theo2": case "wembley":
        return first(() => true, (c) => `${c.venue} · ${c.dateDisplay}`);
      case "surprise": case "stacked": case "notarapper": {
        const c = attended(cs).find((x) => (x.guests?.length ?? 0) > 0);
        return c ? `${c.guests!.join(", ")} · ${c.artist}` : null;
      }
      case "scalped": return first((c) => c.price >= 300, (c) => `$${c.price} · ${c.artist}`);
      case "marathon": return first((c) => c.setlist.length >= 25, (c) => `${c.setlist.length} songs · ${c.artist}`);
      case "beef": case "big3": case "carters": return "You were in the room for all of them";
      case "unheard": return "An unreleased song, live";
      default: {
        const counter = COUNTERS[a.id];
        if (counter) { const [have] = counter(cs); return `${have}`; }
        return null;
      }
    }
  }
  const counter = COUNTERS[a.id];
  if (!counter) return null;
  const [have, need] = counter(cs);
  return have > 0 ? `${have} / ${need}` : null;
}

export function tally(cs: ConcertRec[]) {
  const unlocked = ACHIEVEMENTS.filter((a) => { try { return a.test(cs); } catch { return false; } });
  return { unlocked, points: unlocked.reduce((s, a) => s + a.pts, 0) };
}
