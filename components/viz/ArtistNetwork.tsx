"use client";

import { useMemo } from "react";
import { splitArtists, type ConcertRec } from "@/features/concerts/data";

/* Who you've seen on the same bill: nodes are artists, an edge means they
 * shared a stage at one of YOUR shows (multi-artist bills, openers, and
 * surprise guests all count). Laid out with a tiny force simulation run to
 * convergence at render time — deterministic, no d3, no animation loop. */

interface Node { name: string; shows: number; x: number; y: number; vx: number; vy: number }

export function ArtistNetwork({ concerts, size = 340 }: { concerts: ConcertRec[]; size?: number }) {
  const { nodes, edges } = useMemo(() => {
    const attended = concerts.filter((c) => !c.cancelled);
    const showCount = new Map<string, number>();
    const edgeCount = new Map<string, number>();

    for (const c of attended) {
      const bill = [...new Set([
        ...splitArtists(c.artist),
        ...(c.openers ?? []),
        ...(c.guests ?? []),
      ].map((a) => a.trim()).filter(Boolean))];
      for (const a of bill) showCount.set(a, (showCount.get(a) ?? 0) + 1);
      for (let i = 0; i < bill.length; i++)
        for (let j = i + 1; j < bill.length; j++) {
          const k = [bill[i], bill[j]].sort().join("¦");
          edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
        }
    }

    // keep it legible: only artists that connect to someone, top 24 by shows
    const connected = new Set(
      [...edgeCount.keys()].flatMap((k) => k.split("¦"))
    );
    const names = [...showCount.keys()]
      .filter((n) => connected.has(n))
      .sort((a, b) => (showCount.get(b) ?? 0) - (showCount.get(a) ?? 0))
      .slice(0, 24);
    const keep = new Set(names);

    // deterministic ring start
    const nodes: Node[] = names.map((name, i) => {
      const a = (i / Math.max(1, names.length)) * Math.PI * 2;
      return {
        name, shows: showCount.get(name) ?? 1,
        x: size / 2 + Math.cos(a) * size * 0.32,
        y: size / 2 + Math.sin(a) * size * 0.32,
        vx: 0, vy: 0,
      };
    });
    const idx = new Map(names.map((n, i) => [n, i]));
    const edges = [...edgeCount.entries()]
      .map(([k, w]) => { const [a, b] = k.split("¦"); return { a: idx.get(a), b: idx.get(b), w }; })
      .filter((e): e is { a: number; b: number; w: number } => e.a != null && e.b != null);

    // force sim: springs on edges, repulsion between all, centering
    for (let iter = 0; iter < 260; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const d2 = Math.max(60, dx * dx + dy * dy);
          const f = 2600 / d2;
          const d = Math.sqrt(d2);
          nodes[i].vx -= (dx / d) * f; nodes[i].vy -= (dy / d) * f;
          nodes[j].vx += (dx / d) * f; nodes[j].vy += (dy / d) * f;
        }
      }
      for (const e of edges) {
        const A = nodes[e.a], B = nodes[e.b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - 80) * 0.02 * Math.min(3, e.w);
        A.vx += (dx / d) * f; A.vy += (dy / d) * f;
        B.vx -= (dx / d) * f; B.vy -= (dy / d) * f;
      }
      for (const n of nodes) {
        n.vx += (size / 2 - n.x) * 0.012;
        n.vy += (size / 2 - n.y) * 0.012;
        n.x += n.vx * 0.5; n.y += n.vy * 0.5;
        n.vx *= 0.6; n.vy *= 0.6;
        n.x = Math.max(26, Math.min(size - 26, n.x));
        n.y = Math.max(20, Math.min(size - 14, n.y));
      }
    }
    return { nodes, edges };
  }, [concerts, size]);

  if (nodes.length < 2) {
    return (
      <p className="py-6 text-center text-xs text-sub">
        No shared bills yet — this lights up once shows with multiple artists,
        openers, or surprise guests are in the archive.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      role="img"
      aria-label={`Artist network: ${nodes.length} artists connected by shared bills`}
    >
      {edges.map((e, i) => (
        <line
          key={i}
          x1={nodes[e.a].x} y1={nodes[e.a].y}
          x2={nodes[e.b].x} y2={nodes[e.b].y}
          stroke="#ff9f0a"
          strokeOpacity={Math.min(0.7, 0.18 + e.w * 0.15)}
          strokeWidth={Math.min(3, 0.8 + e.w * 0.6)}
        />
      ))}
      {nodes.map((n) => {
        const r = 4 + Math.min(9, n.shows * 1.6);
        return (
          <g key={n.name}>
            <circle cx={n.x} cy={n.y} r={r} fill="#ff9f0a" opacity={0.9} />
            <circle cx={n.x} cy={n.y} r={r} fill="none" stroke="#000" strokeWidth={1.5} />
            <text
              x={n.x} y={n.y - r - 4}
              textAnchor="middle"
              fill="#d8d8dc" fontSize={8.5} fontWeight={600}
              style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2.5 }}
            >
              {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
