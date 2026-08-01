# heard

**A personal archive of every live music experience you've had.**
Letterboxd for concerts — log every show, and over time it becomes a timeline of your life through live music.

**🔴 Live: [heard-beryl.vercel.app](https://heard-beryl.vercel.app)**

![screenshots coming soon](docs/screenshots.png)

## What it does

- **10-second logging** — search any artist, tour, or festival and the show's setlist, venue, date, and album artwork auto-import from setlist.fm + Spotify
- **Smart search** — one box searches artists, tours, and festivals simultaneously, with Spotify-powered typeahead and "did you mean" corrections
- **Memories, not data** — rate shows, log what you spent, write journal entries, upload photos (rendered as tilted polaroids)
- **Map** — every venue you've been to as glowing pins on a dark world map, auto-geolocated
- **Songs Heard** — every song you've ever heard live, ranked by play count
- **Wrapped** — yearly recaps: shows, cities, hours of live music, top artists leaderboard
- **Share cards** — story-sized PNGs generated on a canvas, shared through the native share sheet

## Design

Two outfits, one app:
- **Phone** — iOS-native feel: SF type, true black, amber accent, bottom tab bar
- **Desktop** — a macOS window: traffic lights, translucent sidebar, floating on a dark desktop

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Leaflet · Canvas API · setlist.fm API · Spotify Web API · deployed on Vercel

## Run it locally

```bash
npm install
cp .env.example .env.local   # add your setlist.fm + Spotify keys
npm run dev
```

Works without keys in demo mode.

## Credits

Concert data from [setlist.fm](https://www.setlist.fm) · Artist images from [Spotify](https://developer.spotify.com) · Map tiles © OpenStreetMap / CARTO
