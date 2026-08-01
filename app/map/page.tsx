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
          <LcdStat label="Shows" value={uniqueShowCount(concerts)} />
          <LcdStat label="Cities" value={cities} />
          <LcdStat label="Venues" value={venues} />
        </div>
      </section>
    </AppShell>
  );
}
