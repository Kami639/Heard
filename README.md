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

## v101 — the feedback release

Everything from the launch-week feedback, in one drop:

**Achievement rarity** — badges now show what % of concert heads hold them
("only 4% of users have this"), computed from an anonymous community
aggregate in Supabase (`badge_rarity()` — counts only, no rows leak). Offline
or pre-community, badges carry an estimated tier instead. Sort by RAREST,
share any unlocked badge as a card.

**Notifications** — installed-PWA web push: "3 years ago tonight" on show
anniversaries and a reminder the day before a logged show. Opt-in from
Profile. Needs VAPID keys + `SUPABASE_SERVICE_ROLE_KEY` + the Vercel cron in
`vercel.json` (daily, `/api/cron/notify`). Generate keys:
`npx web-push generate-vapid-keys`.

**More things to share** — every show can now export a one-of-one generative
gig poster and a ticket stub alongside the classic card; Stats can stamp a
city passport; badges export their own cards.

**Stats & visualizations** — new `/stats` bento wall: a GitHub-style concert
heatmap (tap a day), an artist co-occurrence network built from your shared
bills, and the rest of the numbers. The map gained ▶ PLAY JOURNEY — an
animated flight through every show in date order. Setlists flag tour
rarities: "🦄 3 of 41 nights", counted from setlist.fm.

**Data sources** — `TICKETMASTER_API_KEY` upgrades COMING UP to real
listings (Wikipedia stays as fallback). Link Last.fm or ListenBrainz in
Profile for streamed-vs-seen on artist pages. Apple MusicKit full-song
playback ships behind `NEXT_PUBLIC_MUSICKIT_DEVELOPER_TOKEN` (requires the
Apple Developer Program; previews keep working without it).

**Who else was in the room** — if someone with a published archive was at
your show, the concert page says so and links their profile. Publish-only,
never on by default; re-publish your archive once to become matchable.

**Craft** — shared-element view transitions from archive rows into the
detail hero; first-run onboarding that pushes backfilling (the retention
behavior); a backfill nudge until 5 shows; Dynamic Type support
(`-apple-system-body`), `prefers-contrast` handling, reduced-motion-safe
animations, and nav/labels a11y fixes.

Run the new section of `supabase-schema.sql` once (it's idempotent), then
republish your archive from Profile.

## v101

New: badge rarity percentiles, push notifications (anniversaries + day-before reminders), gig poster / ticket stub / badge / passport share cards, a Stats page (calendar heatmap, artist network, bento stats), animated map journey, song-rarity flags on setlists ("3 of 41 nights"), Ticketmaster-powered upcoming shows, Last.fm/ListenBrainz streams-vs-shows, "who else was in the room", onboarding, and an accessibility pass (Dynamic Type, aria-current, contrast).

One-time setup for the new features (each degrades gracefully if skipped):

1. **Supabase**: re-run `supabase-schema.sql` in the SQL editor (it's idempotent). Enables badge rarity, push subscriptions, and show matching.
2. **Push**: `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` in Vercel. The daily cron is declared in `vercel.json`.
3. **Ticketmaster**: free key at developer.ticketmaster.com → `TICKETMASTER_API_KEY`.
4. **Last.fm**: free key at last.fm/api → `LASTFM_API_KEY`. (ListenBrainz needs no key.)
5. **Apple Music full songs**: requires an Apple Developer token → `NEXT_PUBLIC_MUSICKIT_DEVELOPER_TOKEN`. Hidden until set.

"Who else was in the room" only matches archives published *after* this update — hit "Update snapshot" in Profile once to join the pool.
