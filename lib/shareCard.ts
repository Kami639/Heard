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
