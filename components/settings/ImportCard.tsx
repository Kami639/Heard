"use client";

import { useState } from "react";
import { parseImport, commitImport, type ImportPreview } from "@/lib/importCsv";

/* Paste-from-spreadsheet import. Preview before commit; nothing is written
 * until the user says so. */

export function ImportCard() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<number | null>(null);

  function handleText(t: string) {
    setText(t);
    setDone(null);
    setPreview(t.trim() ? parseImport(t) : null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    handleText(await f.text());
    e.target.value = "";
  }

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-[15px] font-semibold">Import from a spreadsheet</p>
      <p className="pt-1 text-xs text-sub">
        Been keeping the list in Excel or Notes? Paste it here — one show per line:
        <span className="mt-1 block rounded bg-card2 px-2 py-1 font-mono text-[10px]">
          artist, date, venue, city
        </span>
        Header rows, tabs, and Concert Archives CSV exports all work. Duplicates are skipped
        automatically. You can fill in setlists and photos later.
      </p>

      <textarea
        value={text}
        onChange={(e) => handleText(e.target.value)}
        placeholder={"Drake, 2023-10-24, Scotiabank Arena, Toronto\nSZA, Mar 5 2024, Madison Square Garden, New York"}
        aria-label="Paste your concert spreadsheet"
        className="mt-3 min-h-[90px] w-full rounded-lg bg-card2 px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-sub"
      />
      <label className="pressable mt-2 flex cursor-pointer items-center justify-center rounded-lg bg-card2 py-2 text-xs font-semibold text-sub">
        …or upload a .csv / .txt file
        <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" hidden onChange={handleFile} />
      </label>

      {preview && (
        <div className="mt-3 rounded-xl bg-card2 p-3">
          <p className="text-sm font-semibold">
            {preview.rows.length} {preview.rows.length === 1 ? "show" : "shows"} ready
            {preview.duplicates > 0 && <span className="text-sub"> · {preview.duplicates} already in your archive</span>}
            {preview.skipped > 0 && <span className="text-sub"> · {preview.skipped} lines unreadable</span>}
          </p>
          {preview.rows.length > 0 && (
            <>
              <div className="max-h-32 overflow-y-auto pt-2">
                {preview.rows.slice(0, 30).map((r, i) => (
                  <p key={i} className="truncate py-0.5 text-[11px] text-sub">
                    <span className="text-ink">{r.artist}</span> · {r.date.getFullYear()} · {r.venue || "—"}{r.city ? ` · ${r.city}` : ""}
                  </p>
                ))}
                {preview.rows.length > 30 && (
                  <p className="pt-1 text-[10px] text-sub">…and {preview.rows.length - 30} more</p>
                )}
              </div>
              <button
                onClick={() => {
                  const n = commitImport(preview.rows);
                  setDone(n); setText(""); setPreview(null);
                }}
                className="pressable mt-2 w-full rounded-lg bg-accent py-2 text-sm font-bold text-black"
              >
                Import {preview.rows.length} {preview.rows.length === 1 ? "show" : "shows"}
              </button>
            </>
          )}
        </div>
      )}
      {done != null && (
        <p className="pt-2 text-xs text-accent">
          {done} {done === 1 ? "memory" : "memories"} imported. Artist art fills in on its own —
          open any show to add its setlist with one tap.
        </p>
      )}
    </div>
  );
}
