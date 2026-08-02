"use client";

import type { ConcertRec } from "@/features/concerts/data";

/* ---------- helpers ---------- */

function fitText(x: CanvasRenderingContext2D, text: string, maxWidth: number, base: number, family: string, weight = 800): number {
  let size = base;
  x.font = `${weight} ${size}px ${family}`;
  while (x.measureText(text).width > maxWidth && size > 26) {
    size -= 2;
    x.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

async function deliver(canvas: HTMLCanvasElement, filename: string) {
  // Native share sheet on phones (straight to IG/Messages), download on desktop.
  try {
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png")
    );
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const a = document.createElement("a");
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e: any) {
    if (e?.name === "AbortError") return; // user closed the share sheet
    try {
      const a = document.createElement("a");
      a.download = filename;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      alert("Couldn't export the card — try again.");
    }
  }
}

const SF = "-apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

/* ---------- concert card ---------- */

export async function downloadShareCard(c: ConcertRec) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);

  // ambient glow from the album colors
  const glow = x.createRadialGradient(W / 2, 620, 100, W / 2, 620, 900);
  glow.addColorStop(0, c.c1 + "55");
  glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  x.textAlign = "center";
  x.fillStyle = "#FF9F0A";
  x.font = `700 54px ${SF}`;
  x.fillText("heard", W / 2, 150);

  // artwork
  const size = 660, ax = (W - size) / 2, ay = 260;
  x.save();
  roundRect(x, ax, ay, size, size, 40); x.clip();
  const grad = x.createLinearGradient(ax, ay, ax + size, ay + size);
  grad.addColorStop(0, c.c1); grad.addColorStop(1, c.c2);
  x.fillStyle = grad; x.fillRect(ax, ay, size, size);
  const cardImage = c.imageUrl ?? c.artists?.find((a) => a.imageUrl)?.imageUrl ?? null;
  if (cardImage) {
    try {
      const img = await loadImage(cardImage);
      const s = Math.max(size / img.width, size / img.height);
      x.drawImage(img, ax + (size - img.width * s) / 2, ay + (size - img.height * s) / 2, img.width * s, img.height * s);
    } catch {}
  }
  x.restore();

  // artist (auto-shrinks to fit)
  x.fillStyle = "#FFF";
  const artistSize = fitText(x, c.artist, W - 160, 84, SF);
  x.fillText(c.artist, W / 2, ay + size + 130);

  x.fillStyle = "#8E8E93";
  fitText(x, c.tour, W - 200, 42, SF, 400);
  x.fillText(c.tour, W / 2, ay + size + 130 + artistSize * 0.45 + 40);

  const metaY = ay + size + 130 + artistSize * 0.45 + 100;
  x.font = `400 34px ${MONO}`;
  fitText(x, `${c.venue} · ${c.city}`, W - 160, 34, MONO, 400);
  x.fillText(`${c.venue} · ${c.city}`, W / 2, metaY);
  x.font = `400 34px ${MONO}`;
  x.fillText(c.dateDisplay, W / 2, metaY + 52);

  x.fillStyle = "#FF9F0A"; x.font = `400 56px ${SF}`;
  x.fillText("★".repeat(c.rating) + "  ".repeat(0), W / 2, metaY + 140);

  // setlist card
  if (c.setlist.length) {
    const top = metaY + 200;
    x.fillStyle = "#1C1C1E";
    roundRect(x, 100, top, W - 200, Math.min(560, 110 + c.setlist.length * 52), 32); x.fill();
    x.fillStyle = "#8E8E93"; x.font = `600 30px ${SF}`;
    x.fillText("SETLIST", W / 2, top + 66);
    x.fillStyle = "#FFF";
    c.setlist.slice(0, 8).forEach((song, i) => {
      const sz = fitText(x, song, W - 320, 36, SF, 400);
      x.font = `400 ${sz}px ${SF}`;
      x.fillText(song, W / 2, top + 130 + i * 52);
    });
    if (c.setlist.length > 8) {
      x.fillStyle = "#8E8E93"; x.font = `400 32px ${SF}`;
      x.fillText(`+ ${c.setlist.length - 8} more`, W / 2, top + 130 + 8 * 52);
    }
  }

  x.fillStyle = "#8E8E93"; x.font = `400 28px ${MONO}`;
  x.fillText("my concert memory · heard", W / 2, H - 80);

  await deliver(canvas, `heard-${c.artist.replace(/\W+/g, "-").toLowerCase()}.png`);
}

/* ---------- wrapped card ---------- */

export interface WrappedStats {
  year: number; shows: number; cities: number; spent: number; songs: number;
  hours: number; topArtists: { name: string; imageUrl?: string | null }[];
}

export async function downloadWrappedCard(w: WrappedStats) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 0, 50, W / 2, 0, 1100);
  glow.addColorStop(0, "#FF9F0A22"); glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  x.textAlign = "center";
  x.fillStyle = "#FF9F0A"; x.font = `700 50px ${SF}`;
  x.fillText("heard", W / 2, 140);
  x.font = `800 170px ${SF}`;
  x.fillText(`${w.year}`, W / 2, 330);
  x.fillStyle = "#FFF"; x.font = `800 72px ${SF}`;
  x.fillText("WRAPPED", W / 2, 425);

  const stats: [string, string][] = [
    ["SHOWS", `${w.shows}`],
    ["CITIES", `${w.cities}`],
    ["HOURS OF LIVE MUSIC", `≈${w.hours}`],
    ["SONGS HEARD", `${w.songs}`],
  ];
  stats.forEach(([label, value], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const bw = (W - 300) / 2, bx = 120 + col * (bw + 60), by = 520 + row * 250;
    x.fillStyle = "#1C1C1E";
    roundRect(x, bx, by, bw, 210, 28); x.fill();
    x.fillStyle = "#FF9F0A";
    const vs = fitText(x, value, bw - 60, 84, SF);
    x.fillText(value, bx + bw / 2, by + 110);
    x.fillStyle = "#8E8E93"; x.font = `600 26px ${SF}`;
    x.fillText(label, bx + bw / 2, by + 170);
  });

  // top artists
  x.fillStyle = "#8E8E93"; x.font = `600 34px ${SF}`;
  x.fillText("TOP ARTISTS", W / 2, 1130);
  for (let i = 0; i < Math.min(3, w.topArtists.length); i++) {
    const a = w.topArtists[i];
    const cy = 1220 + i * 200;
    if (a.imageUrl) {
      try {
        const img = await loadImage(a.imageUrl);
        x.save();
        x.beginPath(); x.arc(240, cy, 70, 0, Math.PI * 2); x.clip();
        const s = Math.max(140 / img.width, 140 / img.height);
        x.drawImage(img, 240 - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
        x.restore();
      } catch {}
    } else {
      x.fillStyle = "#1C1C1E";
      x.beginPath(); x.arc(240, cy, 70, 0, Math.PI * 2); x.fill();
    }
    x.textAlign = "left";
    x.fillStyle = "#FF9F0A"; x.font = `800 44px ${SF}`;
    x.fillText(`${i + 1}`, 350, cy + 15);
    x.fillStyle = "#FFF";
    const ns = fitText(x, a.name, W - 520, 52, SF, 700);
    x.font = `700 ${ns}px ${SF}`;
    x.fillText(a.name, 410, cy + 15);
    x.textAlign = "center";
  }

  x.fillStyle = "#8E8E93"; x.font = `400 28px ${MONO}`;
  x.fillText("my year in live music · heard", W / 2, H - 80);

  await deliver(canvas, `heard-wrapped-${w.year}.png`);
}

/* ---------- shared texture helpers ---------- */

/** Cheap deterministic PRNG so each show's poster is unique but stable. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

function grain(x: CanvasRenderingContext2D, W: number, H: number, alpha = 0.05) {
  const rnd = seeded("grain");
  x.save();
  x.globalAlpha = alpha;
  for (let i = 0; i < 2200; i++) {
    x.fillStyle = rnd() > 0.5 ? "#fff" : "#000";
    x.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
  }
  x.restore();
}

/* ---------- generative gig poster ---------- */

/** Editorial poster: the night set like it deserved a screen print.
 *  The band pattern is derived from the show itself (id-seeded), so every
 *  poster is one of one. */
export async function downloadGigPoster(c: ConcertRec) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  const rnd = seeded(c.id);
  x.fillStyle = "#0a0a0c"; x.fillRect(0, 0, W, H);

  // data-driven texture: vertical frequency bands in the show's colors,
  // heights seeded by the setlist
  const bands = Math.max(12, Math.min(28, c.setlist.length || 16));
  const bw = W / bands;
  for (let i = 0; i < bands; i++) {
    const h = 240 + rnd() * 900;
    const g = x.createLinearGradient(0, H - h, 0, H);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, (i % 2 ? c.c1 : c.c2) + "66");
    x.fillStyle = g;
    x.fillRect(i * bw, H - h, bw - 4, h);
  }
  // scattered halftone dots up top
  for (let i = 0; i < 260; i++) {
    x.fillStyle = c.c1 + "22";
    const r = 2 + rnd() * 5;
    x.beginPath(); x.arc(rnd() * W, rnd() * 700, r, 0, Math.PI * 2); x.fill();
  }

  // masthead
  x.textAlign = "left";
  x.fillStyle = "#8E8E93"; x.font = `600 30px ${MONO}`;
  x.fillText("HEARD PRESENTS", 90, 150);
  x.fillText("ONE NIGHT ONLY", W - 90 - x.measureText("ONE NIGHT ONLY").width, 150);
  x.strokeStyle = "#2c2c2e"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(90, 180); x.lineTo(W - 90, 180); x.stroke();

  // artist name, stacked word by word, poster-tight
  const words = c.artist.toUpperCase().split(/\s+/).slice(0, 4);
  let y = 340;
  x.fillStyle = "#FFF";
  for (const w of words) {
    const size = fitText(x, w, W - 180, words.length > 2 ? 150 : 190, SF, 800);
    x.font = `800 ${size}px ${SF}`;
    x.fillText(w, 90, y);
    y += size * 0.94;
  }

  if (c.tour) {
    x.fillStyle = c.c1;
    const ts = fitText(x, c.tour.toUpperCase(), W - 180, 52, SF, 700);
    x.font = `700 ${ts}px ${SF}`;
    x.fillText(c.tour.toUpperCase(), 90, y + 30);
    y += 100;
  }

  // setlist as small print, two columns
  const listTop = Math.max(y + 70, 900);
  const list = c.setlist.slice(0, 20);
  if (list.length) {
    x.fillStyle = "#8E8E93"; x.font = `600 26px ${MONO}`;
    x.fillText("— THE SETLIST —", 90, listTop);
    x.fillStyle = "#d8d8dc"; x.font = `400 30px ${SF}`;
    const col = Math.ceil(list.length / 2);
    list.forEach((song, i) => {
      const cx = i < col ? 90 : W / 2 + 20;
      const cy = listTop + 60 + (i % col) * 44;
      const short = song.length > 26 ? song.slice(0, 25) + "…" : song;
      x.font = `400 30px ${SF}`;
      x.fillText(`${String(i + 1).padStart(2, "0")}  ${short}`, cx, cy);
    });
  }

  // gig-poster footer block
  const fy = H - 220;
  x.strokeStyle = "#2c2c2e"; x.beginPath(); x.moveTo(90, fy - 60); x.lineTo(W - 90, fy - 60); x.stroke();
  x.fillStyle = "#FFF";
  const vs = fitText(x, c.venue.toUpperCase(), W - 180, 46, SF, 700);
  x.font = `700 ${vs}px ${SF}`;
  x.fillText(c.venue.toUpperCase(), 90, fy);
  x.fillStyle = "#8E8E93"; x.font = `400 32px ${MONO}`;
  x.fillText(`${c.city.toUpperCase()} · ${c.dateDisplay.toUpperCase()}`, 90, fy + 52);
  if (c.rating > 0) {
    x.fillStyle = "#FF9F0A"; x.font = `400 40px ${SF}`; x.textAlign = "right";
    x.fillText("★".repeat(c.rating), W - 90, fy + 4);
    x.textAlign = "left";
  }
  x.fillStyle = "#5a5a5f"; x.font = `400 24px ${MONO}`;
  x.fillText("archived on heard", 90, H - 70);

  grain(x, W, H);
  await deliver(canvas, `heard-poster-${c.artist.replace(/\W+/g, "-").toLowerCase()}.png`);
}

/* ---------- ticket stub ---------- */

export async function downloadTicketStub(c: ConcertRec) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  const rnd = seeded(c.id + "stub");
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1000);
  glow.addColorStop(0, c.c1 + "30"); glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  // the stub itself: rotated slightly, like it came out of a pocket
  const TW = 880, TH = 1320, tx = (W - TW) / 2, ty = (H - TH) / 2;
  x.save();
  x.translate(W / 2, H / 2); x.rotate(-0.02); x.translate(-W / 2, -H / 2);

  x.shadowColor = "rgba(0,0,0,0.7)"; x.shadowBlur = 60; x.shadowOffsetY = 24;
  x.fillStyle = "#141416";
  roundRect(x, tx, ty, TW, TH, 36); x.fill();
  x.shadowColor = "transparent";

  // color header band
  const hg = x.createLinearGradient(tx, ty, tx + TW, ty);
  hg.addColorStop(0, c.c1); hg.addColorStop(1, c.c2);
  x.save(); roundRect(x, tx, ty, TW, 200, 36); x.clip();
  x.fillStyle = hg; x.fillRect(tx, ty, TW, 230); x.restore();
  x.textAlign = "left";
  x.fillStyle = "rgba(0,0,0,0.75)"; x.font = `800 40px ${SF}`;
  x.fillText("ADMIT ONE", tx + 50, ty + 90);
  x.font = `600 26px ${MONO}`;
  x.fillText("LIVE IN CONCERT", tx + 50, ty + 140);
  x.textAlign = "right";
  x.fillText(`№ ${String(Math.floor(rnd() * 99999)).padStart(5, "0")}`, tx + TW - 50, ty + 140);
  x.textAlign = "left";

  // body
  x.fillStyle = "#FFF";
  const as = fitText(x, c.artist.toUpperCase(), TW - 100, 76, SF, 800);
  x.font = `800 ${as}px ${SF}`;
  x.fillText(c.artist.toUpperCase(), tx + 50, ty + 330);
  if (c.tour) {
    x.fillStyle = "#8E8E93";
    const ts2 = fitText(x, c.tour, TW - 100, 36, SF, 400);
    x.font = `400 ${ts2}px ${SF}`;
    x.fillText(c.tour, tx + 50, ty + 390);
  }

  const rows: [string, string][] = [
    ["VENUE", c.venue],
    ["CITY", c.city + (c.country ? `, ${c.country}` : "")],
    ["DATE", c.dateDisplay],
    ["PRICE", c.price > 0 ? `$${c.price}` : "GUEST LIST"],
    ["SEC / ROW / SEAT", `GA / ${String.fromCharCode(65 + Math.floor(rnd() * 20))} / ${1 + Math.floor(rnd() * 40)}`],
  ];
  rows.forEach(([label, val], i) => {
    const ry = ty + 490 + i * 108;
    x.fillStyle = "#5a5a5f"; x.font = `600 24px ${MONO}`;
    x.fillText(label, tx + 50, ry);
    x.fillStyle = "#EDEDEF";
    const vsz = fitText(x, val, TW - 120, 40, SF, 600);
    x.font = `600 ${vsz}px ${SF}`;
    x.fillText(val, tx + 50, ry + 44);
  });

  // perforation
  const py = ty + TH - 250;
  x.setLineDash([2, 14]); x.strokeStyle = "#4a4a4f"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(tx + 20, py); x.lineTo(tx + TW - 20, py); x.stroke();
  x.setLineDash([]);
  // punch-hole notches
  for (const nx of [tx, tx + TW]) {
    x.fillStyle = "#000";
    x.beginPath(); x.arc(nx, py, 26, 0, Math.PI * 2); x.fill();
  }

  // barcode from the show id
  let bx = tx + 60;
  x.fillStyle = "#EDEDEF";
  while (bx < tx + TW - 200) {
    const bwid = 3 + Math.floor(rnd() * 9);
    if (rnd() > 0.42) x.fillRect(bx, py + 60, bwid, 120);
    bx += bwid + 4;
  }
  x.fillStyle = "#8E8E93"; x.font = `400 26px ${MONO}`; x.textAlign = "right";
  if (c.rating > 0) x.fillText("★".repeat(c.rating), tx + TW - 50, py + 130);
  x.textAlign = "left";
  x.restore();

  x.textAlign = "center";
  x.fillStyle = "#8E8E93"; x.font = `400 28px ${MONO}`;
  x.fillText("i was there · heard", W / 2, H - 80);

  grain(x, W, H, 0.04);
  await deliver(canvas, `heard-stub-${c.artist.replace(/\W+/g, "-").toLowerCase()}.png`);
}

/* ---------- achievement badge card ---------- */

export async function downloadBadgeCard(badge: {
  icon: string; name: string; desc: string; pts: number;
  pct: number | null; tierLabel: string; evidence?: string | null;
}) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 760, 60, W / 2, 760, 900);
  glow.addColorStop(0, "#FF9F0A33"); glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  x.textAlign = "center";
  x.fillStyle = "#FF9F0A"; x.font = `700 50px ${SF}`;
  x.fillText("heard", W / 2, 150);
  x.fillStyle = "#8E8E93"; x.font = `600 32px ${MONO}`;
  x.fillText("ACHIEVEMENT UNLOCKED", W / 2, 230);

  // medallion
  x.save();
  x.beginPath(); x.arc(W / 2, 700, 260, 0, Math.PI * 2);
  x.fillStyle = "#1C1C1E"; x.fill();
  x.lineWidth = 10; x.strokeStyle = "#FF9F0A"; x.stroke();
  x.restore();
  x.font = `240px ${SF}`;
  x.fillText(badge.icon, W / 2, 785);

  x.fillStyle = "#FFF";
  const ns = fitText(x, badge.name, W - 160, 84, SF, 800);
  x.font = `800 ${ns}px ${SF}`;
  x.fillText(badge.name, W / 2, 1120);
  x.fillStyle = "#8E8E93";
  const ds = fitText(x, badge.desc, W - 200, 40, SF, 400);
  x.font = `400 ${ds}px ${SF}`;
  x.fillText(badge.desc, W / 2, 1190);

  // rarity plate — the flex
  const plateW = 700, plateY = 1290;
  x.fillStyle = "#1C1C1E";
  roundRect(x, (W - plateW) / 2, plateY, plateW, 210, 32); x.fill();
  x.fillStyle = "#FF9F0A"; x.font = `800 72px ${SF}`;
  x.fillText(
    badge.pct != null ? `${badge.pct}% OF USERS` : badge.tierLabel,
    W / 2, plateY + 105
  );
  x.fillStyle = "#8E8E93"; x.font = `600 28px ${SF}`;
  x.fillText(badge.pct != null ? "HAVE THIS BADGE" : "TIER", W / 2, plateY + 165);

  if (badge.evidence) {
    x.fillStyle = "#d8d8dc"; x.font = `400 30px ${MONO}`;
    const ev = badge.evidence.length > 44 ? badge.evidence.slice(0, 43) + "…" : badge.evidence;
    x.fillText(ev, W / 2, 1600);
  }
  x.fillStyle = "#FF9F0A"; x.font = `400 44px ${SF}`;
  x.fillText(`★ ${badge.pts} pts`, W / 2, 1690);

  x.fillStyle = "#8E8E93"; x.font = `400 28px ${MONO}`;
  x.fillText("my concert archive · heard", W / 2, H - 80);

  grain(x, W, H, 0.04);
  await deliver(canvas, `heard-badge-${badge.name.replace(/\W+/g, "-").toLowerCase()}.png`);
}

/* ---------- city passport ---------- */

export async function downloadPassportCard(stamps: {
  city: string; country?: string; shows: number; firstYear: number;
}[], holderName?: string) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d")!;
  await (document as any).fonts?.ready;

  // passport-paper background
  x.fillStyle = "#0e0d0a"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#2a2820"; x.lineWidth = 1;
  for (let gy = 0; gy < H; gy += 46) { // guilloché-ish wave lines
    x.beginPath();
    for (let gx = 0; gx <= W; gx += 8) {
      const yy = gy + Math.sin((gx + gy) / 60) * 8;
      gx === 0 ? x.moveTo(gx, yy) : x.lineTo(gx, yy);
    }
    x.stroke();
  }

  x.textAlign = "center";
  x.fillStyle = "#FF9F0A"; x.font = `700 46px ${SF}`;
  x.fillText("heard", W / 2, 130);
  x.fillStyle = "#c9b98a"; x.font = `700 58px ${SF}`;
  x.fillText("CONCERT PASSPORT", W / 2, 210);
  x.fillStyle = "#8E8E93"; x.font = `400 30px ${MONO}`;
  x.fillText(holderName ? `HOLDER · ${holderName.toUpperCase()}` : "OFFICIAL RECORD OF NIGHTS OUT", W / 2, 265);

  // stamps: rotated rings, one per city
  const top = stamps.slice(0, 12);
  const rnd = seeded(top.map((s) => s.city).join());
  const cols = 3, cw = (W - 160) / cols;
  top.forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = 80 + col * cw + cw / 2 + (rnd() - 0.5) * 30;
    const cy = 430 + row * 360 + (rnd() - 0.5) * 30;
    const rot = (rnd() - 0.5) * 0.5;
    const hue = [["#c9573f"], ["#3f7ac9"], ["#3fc978"], ["#c9a53f"], ["#a53fc9"]][i % 5][0];

    x.save();
    x.translate(cx, cy); x.rotate(rot);
    x.globalAlpha = 0.9;
    x.strokeStyle = hue; x.lineWidth = 6;
    x.beginPath(); x.arc(0, 0, 130, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2;
    x.beginPath(); x.arc(0, 0, 112, 0, Math.PI * 2); x.stroke();

    x.fillStyle = hue;
    const citySize = fitText(x, s.city.toUpperCase(), 190, 34, SF, 800);
    x.font = `800 ${citySize}px ${SF}`;
    x.fillText(s.city.toUpperCase(), 0, -14);
    x.font = `600 22px ${MONO}`;
    x.fillText(`${s.shows} ${s.shows === 1 ? "SHOW" : "SHOWS"}`, 0, 26);
    x.fillText(`SINCE ${s.firstYear}`, 0, 58);

    if (s.country) {
      x.font = `700 20px ${MONO}`;
      x.fillText(`· ${s.country.toUpperCase()} ·`, 0, -62);
    }
    x.globalAlpha = 1;
    x.restore();
  });

  const total = stamps.reduce((n, s) => n + s.shows, 0);
  x.fillStyle = "#c9b98a"; x.font = `600 34px ${MONO}`;
  x.fillText(`${stamps.length} CITIES · ${total} SHOWS`, W / 2, H - 140);
  x.fillStyle = "#8E8E93"; x.font = `400 28px ${MONO}`;
  x.fillText("stamped by heard", W / 2, H - 80);

  grain(x, W, H, 0.05);
  await deliver(canvas, `heard-passport.png`);
}
