export interface Concert {
  id: string;
  artist: string;
  tour: string | null;
  venue: string;
  city: string;
  country: string;
  date: string; // ISO
  rating: number | null; // 1-5
  priceCents: number | null;
  notes: string | null;
  setlist: SetlistSong[];
  photoUrls: string[];
  setlistFmId: string | null;
}

export interface SetlistSong {
  name: string;
  encore: boolean;
  cover: string | null; // original artist if a cover
  withGuest?: string | null; // guest artist who came out for this song
}
