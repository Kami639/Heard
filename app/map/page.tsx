"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts, updateConcert } from "@/lib/store";
import type { ConcertRec } from "@/features/concerts/data";

/** been-style map: dark world, amber pins. Auto-locates concerts missing
 *  coordinates via OpenStreetMap's free geocoder (1 req/sec, cached). */
export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [locating, setLocating] = useState(false);

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
        L.marker([c.lat!, c.lng!], { icon }).addTo(map)
          .bindPopup(`<b>${c.artist}</b><br/>${c.venue}<br/>${c.dateDisplay}`);

      const located = cs.filter((c) => c.lat != null && c.lng != null);
      located.forEach(addPin);
      if (located.length) {
        map.fitBounds(located.map((c) => [c.lat!, c.lng!] as [number, number]), { padding: [40, 40], maxZoom: 6 });
      } else {
        map.setView([25, 0], 2);
      }

      // geocode the ones missing coords (venue+city via OSM), politely rate-limited
      const missing = cs.filter((c) => c.lat == null || c.lng == null).slice(0, 15);
      if (!missing.length) return;
      setLocating(true);
      const cache = new Map<string, [number, number] | null>();
      for (const c of missing) {
        if (cancelled) return;
        const q = `${c.venue}, ${c.city}`;
        let hit = cache.get(q);
        if (hit === undefined) {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
            );
            const data = await res.json();
            hit = data?.[0] ? [Number(data[0].lat), Number(data[0].lon)] : null;
            // fall back to city only if the venue name confuses it
            if (!hit) {
              const res2 = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(c.city)}`
              );
              const d2 = await res2.json();
              hit = d2?.[0] ? [Number(d2[0].lat), Number(d2[0].lon)] : null;
            }
          } catch { hit = null; }
          cache.set(q, hit);
          await new Promise((r) => setTimeout(r, 1100)); // OSM rate limit
        }
        if (hit) {
          updateConcert(c.id, { lat: hit[0], lng: hit[1] });
          c.lat = hit[0]; c.lng = hit[1];
          addPin(c);
        }
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
      if (map) { map.remove(); if (ref.current) (ref.current as any)._map = null; }
    };
  }, []);

  const cities = new Set(concerts.map((c) => c.city)).size;
  const venues = new Set(concerts.map((c) => c.venue)).size;

  return (
    <AppShell title="map" count={concerts.length}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <section className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-2">
        <div ref={ref} className="h-80 w-full overflow-hidden rounded-2xl bg-card" />
        {locating && <p className="text-center text-xs text-sub">Locating venues…</p>}
        <div className="grid grid-cols-3 gap-3">
          <LcdStat label="Shows" value={concerts.length} />
          <LcdStat label="Cities" value={cities} />
          <LcdStat label="Venues" value={venues} />
        </div>
      </section>
    </AppShell>
  );
}
