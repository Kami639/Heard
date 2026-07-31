# Heard

A personal archive of every live music experience you've had.
Letterboxd for concerts — designed like an old iPod that's been upgraded for 2026.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `SETLISTFM_API_KEY` — free non-commercial key from setlist.fm (approval is quick)
   - Supabase URL + anon key
3. `npm run dev`

## How setlist auto-import works

- The client never touches setlist.fm directly. It calls `/api/setlist/search?artist=...&date=...`,
  which proxies through `lib/setlistfm.ts` so the API key stays server-side.
- Responses are cached for 1 hour (`next.revalidate`) because the free tier is ~2 req/sec.
- setlist.fm returns **404 for zero results** — the wrapper maps that to an empty array.
- Setlists are community-contributed, so last night's show may be missing for a day or two.
  Show "Setlist not available yet. Retry sync?" instead of an error.
- Attribution to setlist.fm in the UI is required by their terms.

## Design system

Tokens live in `app/globals.css` (`@theme`): paper `#F5F2EA`, card `#ECE6DA`,
ink `#1E1E1E`, hairline `#B9B2A6`, LCD green for stats. IBM Plex Sans (body),
Archivo (display), IBM Plex Mono (data). Every page gets paper grain + vignette
via the `.grain` class. Buttons use `.pressable` — they sink, never glow.

## Structure

```
app/                  routes (home = boot + iPod menu)
  api/setlist/search  server proxy for setlist.fm
components/
  ipod/               ClickWheel — the signature element
  lcd/                LcdStat — dashboard numbers as tiny LCDs
  cassette/           CassetteCard — timeline rows as tapes
features/concerts/    domain types
lib/setlistfm.ts      API wrapper (server-only)
public/textures/      grain.svg
```

## Next steps

- [ ] Supabase schema: `concerts`, `photos`, `songs_heard` + RLS per user
- [ ] Add-concert flow: search → pick show → autofilled concert page
- [ ] /archive (cassette timeline), /wrapped (CD-insert animation), map view
- [ ] Photo upload (Supabase Storage) with polaroid rendering
- [ ] Shareable recap cards (og-image route)
