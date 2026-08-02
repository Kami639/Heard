"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts, updateConcert } from "@/lib/store";
import { uniqueShowCount, type ConcertRec } from "@/features/concerts/data";

/** been-style map: dark world, amber pins. Auto-locates concerts missing
 *  coordinates via OpenStreetMap's free geocoder (1 req/sec, cached). */
export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const journeyRef = useRef<{ stop: boolean; layers: any[] }>({ stop: false, layers: [] });
  const [journey, setJourney] = useState<{ playing: boolean; label: string | null }>({ playing: false, label: null });

  useEffect(() => {
    let map: any;
    let cancelled = false;

    (async () => {
      let cs = getConcerts();
      setConcerts(cs);

      const L = (await import("leaflet")).default;
      if (!ref.current || (ref.current as any)._map) return;
      map = L.map(ref.current, { zoomControl: false, worldCopyJump: true });
      (ref.current as any)._map = map;
      mapRef.current = map; LRef.current = L;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd", maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#FF9F0A;border:2px solid #000;box-shadow:0 0 12px rgba(255,159,10,0.9)"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });

      const addPin = (c: ConcertRec) =>
        L.marker([c.lat!, c.lng!], { icon, opacity: c.geoApprox ? 0.75 : 1 }).addTo(map)
          .bindPopup(`<b>${c.artist}</b><br/>${c.venue}<br/>${c.dateDisplay}`);

      const located = cs.filter((c) => c.lat != null && c.lng != null && !c.cancelled);
      located.forEach(addPin);
      if (located.length) {
        map.fitBounds(located.map((c) => [c.lat!, c.lng!] as [number, number]), { padding: [40, 40], maxZoom: 6 });
      } else {
        map.setView([25, 0], 2);
      }

      /* Geocoding, done carefully.
         Nominatim will cheerfully return a "Rabbit Hole" pub in England for
         a Charlotte venue, so every lookup is BOUNDED to a box around the
         concert's own city, and anything that lands absurdly far away is
         rejected in favour of the city centre. Existing pins are re-checked
         the same way, so archives saved before this fix repair themselves. */
      const KM = (a: [number, number], b: [number, number]) => {
        const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2 +
          Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };

      const cityCache = new Map<string, [number, number] | null>();
      const wait = () => new Promise((r) => setTimeout(r, 1100)); // OSM: 1 req/sec

      async function osm(query: string, box?: [number, number]): Promise<[number, number] | null> {
        const params = new URLSearchParams({ format: "json", limit: "1", q: query });
        if (box) {
          // ±0.6° ≈ 65km around the city
          params.set("viewbox", `${box[1] - 0.6},${box[0] + 0.6},${box[1] + 0.6},${box[0] - 0.6}`);
          params.set("bounded", "1");
        }
        try {
          params.set("email", "heard-app@users.noreply.github.com"); // OSM asks for contact on automated use
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
          const data = await res.json();
          return data?.[0] ? [Number(data[0].lat), Number(data[0].lon)] : null;
        } catch { return null; }
      }

      async function cityCoords(c: ConcertRec): Promise<[number, number] | null> {
        const key = `${c.city}|${c.country ?? ""}`.toLowerCase();
        if (cityCache.has(key)) return cityCache.get(key)!;
        const hit = await osm([c.city, c.country].filter(Boolean).join(", "));
        cityCache.set(key, hit);
        await wait();
        return hit;
      }

      // needs work: no coords, or coords that were never validated
      const needsGeo = cs.filter((c) => c.lat == null || c.lng == null || !c.geoChecked).slice(0, 12);
      if (!needsGeo.length) return;
      setLocating(true);

      for (const c of needsGeo) {
        if (cancelled) return;
        const centre = await cityCoords(c);

        // already-placed pin: keep it if it's plausibly in the right city
        if (c.lat != null && c.lng != null) {
          if (!centre || KM([c.lat, c.lng], centre) < 120) {
            updateConcert(c.id, { geoChecked: true });
            continue;
          }
        }

        let hit: [number, number] | null = null;
        if (c.venue && c.venue !== "Unknown venue") {
          hit = await osm(`${c.venue}, ${c.city}`, centre ?? undefined);
          await wait();
          // sanity check even inside the box
          if (hit && centre && KM(hit, centre) > 120) hit = null;
        }
        const approx = !hit;
        if (!hit) hit = centre;
        if (!hit) { updateConcert(c.id, { geoChecked: true }); continue; }

        updateConcert(c.id, { lat: hit[0], lng: hit[1], geoChecked: true, geoApprox: approx });
        c.lat = hit[0]; c.lng = hit[1];
        addPin(c);
      }
      if (!cancelled) {
        setConcerts(getConcerts());
        setLocating(false);
        const all = getConcerts().filter((c) => c.lat != null);
        if (all.length) map.fitBounds(all.map((c) => [c.lat!, c.lng!] as [number, number]), { padding: [40, 40], maxZoom: 6 });
      }
    })();

    return () => {
      cancelled = true;
      journeyRef.current.stop = true; // halt a journey mid-flight
      mapRef.current = null;
      if (map) { map.remove(); if (ref.current) (ref.current as any)._map = null; }
    };
  }, []);

  /* ── the journey ────────────────────────────────────────────────────
   * Flies through every located show in date order, unspooling an amber
   * line behind it — your live-music life as one continuous trip. */
  function stopJourney() {
    journeyRef.current.stop = true;
    for (const l of journeyRef.current.layers) { try { mapRef.current?.removeLayer(l); } catch {} }
    journeyRef.current.layers = [];
    setJourney({ playing: false, label: null });
    const all = getConcerts().filter((c) => c.lat != null && !c.cancelled);
    if (all.length && mapRef.current) {
      mapRef.current.fitBounds(all.map((c) => [c.lat!, c.lng!]), { padding: [40, 40], maxZoom: 6 });
    }
  }

  async function playJourney() {
    const map = mapRef.current, L = LRef.current;
    if (!map || !L) return;
    const stops = getConcerts()
      .filter((c) => c.lat != null && c.lng != null && !c.cancelled)
      .map((c) => ({ c, t: +new Date(c.dateDisplay) }))
      .filter((x) => !isNaN(x.t) && x.t <= Date.now())
      .sort((a, b) => a.t - b.t)
      .map((x) => x.c);
    if (stops.length < 2) return;

    journeyRef.current = { stop: false, layers: [] };
    setJourney({ playing: true, label: null });
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const line = L.polyline([], { color: "#FF9F0A", weight: 2.5, opacity: 0.8, dashArray: "1 6" }).addTo(map);
    journeyRef.current.layers.push(line);

    for (let i = 0; i < stops.length; i++) {
      if (journeyRef.current.stop || !mapRef.current) return;
      const c = stops[i];
      const pt: [number, number] = [c.lat!, c.lng!];
      line.addLatLng(pt);
      const halo = L.circleMarker(pt, { radius: 9, color: "#FF9F0A", weight: 2, fillColor: "#FF9F0A", fillOpacity: 0.35 }).addTo(map);
      journeyRef.current.layers.push(halo);
      setJourney({ playing: true, label: `${c.year} · ${c.artist} · ${c.city}` });
      if (reduced) map.setView(pt, Math.max(map.getZoom(), 5));
      else map.flyTo(pt, Math.max(4.5, Math.min(8, map.getZoom() ?? 5)), { duration: 1.1 });
      await new Promise((r) => setTimeout(r, reduced ? 500 : 1400));
    }
    setJourney((j) => ({ ...j, playing: false }));
  }

  const cities = new Set(concerts.map((c) => c.city)).size;
  const venues = new Set(concerts.map((c) => c.venue)).size;

  return (
    <AppShell title="map" count={concerts.length}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <section className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-2">
        <div ref={ref} className="h-80 w-full overflow-hidden rounded-2xl bg-card" />
        {locating && <p className="text-center text-xs text-sub">Locating venues…</p>}
        <div className="flex items-center justify-between">
          <button
            onClick={journey.playing ? stopJourney : playJourney}
            className={`pressable rounded-full px-5 py-2 font-mono text-xs tracking-[0.15em] ${
              journey.playing ? "bg-card text-sub" : "bg-accent font-semibold text-black"
            }`}
          >
            {journey.playing ? "■ STOP" : "▶ PLAY JOURNEY"}
          </button>
          {journey.label && (
            <span className="fade-up min-w-0 truncate pl-3 text-right font-mono text-[11px] text-accent">{journey.label}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Shows" value={uniqueShowCount(concerts)} />
          <LcdStat label="Cities" value={cities} />
          <LcdStat label="Venues" value={venues} />
        </div>
      </section>
    </AppShell>
  );
}
