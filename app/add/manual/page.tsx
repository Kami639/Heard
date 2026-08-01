"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { addConcert } from "@/lib/store";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

// For shows neither setlist.fm nor Wikipedia has — festivals, local bills,
// one-offs. Claude can pre-fill what it knows, but YOU confirm every field:
// nothing is saved until you press Add.

const field = "w-full rounded-lg bg-card2 px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-sub";

export default function ManualAdd() {
  const router = useRouter();
  const [form, setForm] = useState({
    artist: "", tour: "", venue: "", city: "", country: "", date: "", songs: "",
  });
  const [lookup, setLookup] = useState<"idle" | "loading" | "off">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [scan, setScan] = useState<"idle" | "reading" | "off">("idle");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function askClaude() {
    if (!form.artist && !form.tour) return;
    setLookup("loading");
    setNote(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "event",
          stats: { event: form.tour || form.artist, artist: form.artist, city: form.city, date: form.date },
        }),
      });
      const d = await res.json();
      if (!d.text) { setLookup("off"); return; }
      const p = JSON.parse(d.text.replace(/```json|```/g, "").trim());
      setForm((f) => ({
        ...f,
        artist: [p.artist, ...(p.lineup ?? [])].filter(Boolean).slice(0, 5).join(" & ") || f.artist,
        venue: p.venue || f.venue,
        city: p.city || f.city,
        country: p.country || f.country,
        date: p.date || f.date,
      }));
      setNote(
        `${p.note ? p.note + " " : ""}Filled in by Claude${p.confidence ? ` (${p.confidence} confidence)` : ""} — check it before saving.`
      );
      setLookup("idle");
    } catch { setLookup("off"); }
  }

  async function scanTicket(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setNote("That file's over 8MB — try a screenshot instead."); return; }
    setScan("reading");
    setNote(null);
    try {
      const data: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(f);
      });
      const r = await fetch("/api/ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data, mediaType: f.type || "image/jpeg" }),
      });
      const d = await r.json();
      if (!d.ticket) { setScan(d.configured === false ? "off" : "idle"); setNote("Couldn't read that ticket — fill it in by hand."); return; }
      const t = d.ticket;
      setForm((prev) => ({
        ...prev,
        artist: t.artist || prev.artist,
        tour: t.tour || prev.tour,
        venue: t.venue || prev.venue,
        city: t.city || prev.city,
        country: t.country || prev.country,
        date: t.date || prev.date,
      }));
      setNote(`Read from your ticket${t.seat ? ` · ${t.seat}` : ""} — check it before saving.`);
      setScan("idle");
    } catch { setScan("idle"); setNote("Couldn't read that file."); }
  }

  function save() {
    if (!form.artist.trim() || !form.date) return;
    const d = new Date(form.date);
    const names = splitArtists(form.artist);
    const c: ConcertRec = {
      id: `manual-${Date.now()}`,
      artist: form.artist.trim(),
      artists: names.map((name) => ({ name, imageUrl: null })),
      tour: form.tour.trim() || "Live",
      venue: form.venue.trim() || "Unknown venue",
      city: form.city.trim(),
      country: form.country.trim().toUpperCase() || undefined,
      dateDisplay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      year: d.getFullYear(),
      setlist: form.songs.split("\n").map((x) => x.trim()).filter(Boolean),
      rating: 5, price: 0, photos: 0, notes: "",
      c1: "#3a3a3c", c2: "#1c1c1e",
      initials: form.artist.trim()[0]?.toUpperCase() ?? "?",
      lat: null, lng: null,
    };
    addConcert(c);
    // grab artist photos in the background
    names.slice(0, 4).forEach(async (name, i) => {
      try {
        const r = await fetch(`/api/artist?name=${encodeURIComponent(name)}`);
        const url = (await r.json()).artist?.imageUrl ?? null;
        if (url) {
          const { getConcerts, updateConcert } = await import("@/lib/store");
          const cur = getConcerts().find((x) => x.id === c.id);
          if (!cur) return;
          const artists = [...(cur.artists ?? [])];
          artists[i] = { name, imageUrl: url };
          updateConcert(c.id, { artists, ...(i === 0 ? { imageUrl: url } : {}) });
        }
      } catch {}
    });
    router.push(`/concert/${c.id}?added=1`);
  }

  return (
    <AppShell title="add manually">
      <section className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-2">
        <p className="text-xs text-sub">
          For shows the databases don&apos;t have — festivals, local bills, one-offs.
        </p>

        <input className={field} placeholder="Artist(s) — separate with &" value={form.artist} onChange={set("artist")} />
        <input className={field} placeholder="Tour or festival (e.g. Dreamville Festival 2025)" value={form.tour} onChange={set("tour")} />

        <label className={`pressable flex cursor-pointer items-center justify-center rounded-lg bg-card py-2.5 text-sm font-semibold ${scan === "off" ? "text-sub" : "text-accent"}`}>
          {scan === "reading" ? "Reading your ticket…" : scan === "off" ? "Ticket scan needs an API key" : "🎫 Scan a ticket (photo or PDF)"}
          <input type="file" accept="image/*,application/pdf" hidden onChange={scanTicket} />
        </label>

        <button
          onClick={askClaude}
          disabled={lookup === "loading" || (!form.artist && !form.tour)}
          className="pressable rounded-lg bg-card py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
        >
          {lookup === "loading" ? "Looking it up…" : lookup === "off" ? "Lookup unavailable — add an API key" : "✨ Fill in what Claude knows"}
        </button>
        {note && <p className="text-[11px] text-sub">{note}</p>}

        <input className={field} placeholder="Venue" value={form.venue} onChange={set("venue")} />
        <div className="flex gap-2">
          <input className={field} placeholder="City" value={form.city} onChange={set("city")} />
          <input className={`${field} w-24 shrink-0`} placeholder="US" maxLength={2} value={form.country} onChange={set("country")} />
        </div>
        <input className={field} type="date" value={form.date} onChange={set("date")} />

        <textarea
          className={`${field} min-h-[120px] font-mono text-sm`}
          placeholder={"Songs, one per line (optional)\nParse the poster lineup here too"}
          value={form.songs}
          onChange={set("songs")}
        />

        <div className="flex gap-2 pt-1">
          <button onClick={() => router.back()} className="pressable flex-1 rounded-xl bg-card2 py-3 text-sm font-semibold text-sub">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.artist.trim() || !form.date}
            className="pressable flex-[1.6] rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-40"
          >
            ＋ Add to archive
          </button>
        </div>
      </section>
    </AppShell>
  );
}
