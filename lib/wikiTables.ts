import * as cheerio from "cheerio";
import { politeJson } from "./requestQueue";

/* Parsing Wikipedia tables from RENDERED HTML rather than raw wikitext.
   MediaWiki has already expanded templates, resolved {{Start date}}, and
   emitted real <td>/<th> cells — all we have to do is expand rowspan and
   colspan into a flat grid. This is what makes multi-night runs (where the
   city and venue are merged across rows) parse correctly on every article
   format, instead of only the ones my regex happened to fit. */

export interface WikiTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

/** Expand a table into a dense grid: a cell spanning 3 rows appears in all 3. */
function expand($: cheerio.CheerioAPI, table: any): string[][] {
  const grid: string[][] = [];
  const rows = $(table).find("tr").toArray();

  rows.forEach((tr, r) => {
    grid[r] ??= [];
    let col = 0;
    $(tr).find("th, td").each((_, cell) => {
      while (grid[r][col] !== undefined) col++; // skip cells filled by a rowspan above

      const $cell = $(cell);
      $cell.find("sup.reference, sup.noprint, style").remove(); // drop [a] footnotes
      const text = $cell.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

      const colspan = Math.min(Number($cell.attr("colspan") ?? 1) || 1, 20);
      const rowspan = Math.min(Number($cell.attr("rowspan") ?? 1) || 1, 60);

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          grid[r + dr] ??= [];
          grid[r + dr][col + dc] = text;
        }
      }
      col += colspan;
    });
  });

  return grid.map((row) => Array.from(row, (c) => c ?? ""));
}

/** Every wikitable on a rendered page, flattened and header-labelled. */
export function parseWikiTables(html: string): WikiTable[] {
  const $ = cheerio.load(html);
  const out: WikiTable[] = [];

  $("table.wikitable").each((_, table) => {
    const grid = expand($, table);
    if (grid.length < 2) return;

    // the header row is the first one made mostly of <th>
    const rowEls = $(table).find("tr").toArray();
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rowEls.length, 3); i++) {
      const ths = $(rowEls[i]).find("th").length;
      const tds = $(rowEls[i]).find("td").length;
      if (ths > tds) { headerIdx = i; break; }
    }

    out.push({
      caption: $(table).find("caption").first().text().replace(/\s+/g, " ").trim(),
      headers: (grid[headerIdx] ?? []).map((h) => h.toLowerCase()),
      rows: grid.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim().length)),
    });
  });

  return out;
}

/** Fetch a page's rendered HTML through the MediaWiki action API. */
export async function fetchRenderedHtml(title: string): Promise<string | null> {
  const qs = new URLSearchParams({
    action: "parse", page: title, prop: "text", formatversion: "2",
    format: "json", redirects: "1",
  });
  const data = await politeJson<any>(`https://en.wikipedia.org/w/api.php?${qs}`, {
    ttl: 7 * 24 * 3600 * 1000,
  });
  return data?.parse?.text ?? null;
}
