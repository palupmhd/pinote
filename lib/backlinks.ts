import type { BoardElement } from "./types";

export interface Backlink {
  /** id Note yang me-mention board target. */
  noteId: string;
  /** board tempat Note itu berada (untuk lompat & label). */
  boardId: string;
  /** cuplikan teks Note untuk daftar backlink. */
  snippet: string;
}

const PREFIX = "board:";

/** Referensi balik ke sebuah board (spec §9.3): semua Note yang me-mention board
 *  ini lewat tautan `board:<id>` (dihasilkan node mention). Diturunkan dari data,
 *  tak disimpan — konsisten dg rollup/relation-arrow. Client-only (pakai DOMParser).*/
export function backlinksTo(
  targetBoardId: string,
  elements: Record<string, BoardElement>
): Backlink[] {
  if (typeof window === "undefined") return [];
  const href = `${PREFIX}${targetBoardId}`;
  const out: Backlink[] = [];
  for (const el of Object.values(elements)) {
    if (el.type !== "NOTE") continue;
    const html = el.content.html;
    if (!html || !html.includes(href)) continue; // saring cepat sebelum parse
    const doc = new DOMParser().parseFromString(html, "text/html");
    const hit = Array.from(doc.querySelectorAll(`a[href^="${PREFIX}"]`)).some(
      (a) => a.getAttribute("href") === href
    );
    if (!hit) continue;
    const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    out.push({ noteId: el.id, boardId: el.boardId, snippet: text.slice(0, 80) || "(catatan)" });
  }
  return out;
}
