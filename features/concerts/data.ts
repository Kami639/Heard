export interface ConcertRec {
  id: string;
  artist: string;
  tour: string;
  venue: string;
  city: string;
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
  photosData?: string[]; // compressed dataURLs
  lat?: number | null;
  lng?: number | null;
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
