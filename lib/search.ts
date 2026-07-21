import type { Board, BoardElement, Database } from "./types";

/** Pencarian lintas papan (spec §6 gap #6). SENGAJA client-side atas workspace
 *  di memori, bukan Postgres full-text seperti draft spec: datanya satu blob
 *  JSON per user (bukan baris per elemen), aplikasinya offline-first, dan
 *  ukurannya personal — cari lokal jadi instan & tetap jalan tanpa koneksi.
 *  Kalau nanti pindah ke penyimpanan per-elemen + multi-user, ganti ke FTS. */
export interface SearchHit {
  kind: "element" | "board";
  id: string; // elementId (kind=element) atau boardId (kind=board)
  boardTitle: string; // papan tempat hit ini (untuk konteks)
  typeLabel: string; // "Catatan" | "Tugas" | "Tautan" | "Database" | "Papan"
  label: string; // teks utama hasil
  snippet: string; // potongan di sekitar kecocokan
}

const MAX_HITS = 40;

const htmlToText = (html: string): string => {
  if (!html) return "";
  // Search jalan client-side: parser HTML asli menangani tag & entitas dengan
  // benar (termasuk numeric/&quot;/&#39; dan '>' di dalam atribut) — jauh lebih
  // tepat dari strip regex.
  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  // Fallback non-browser: strip kasar + decode entitas umum.
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
};

/** Potongan ~kata di sekitar kecocokan pertama, biar hasil terbaca. */
function snippetAround(text: string, ql: string): string {
  const i = text.toLowerCase().indexOf(ql);
  if (i < 0) return text.slice(0, 80);
  const start = Math.max(0, i - 30);
  const end = Math.min(text.length, i + ql.length + 40);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

interface WorkspaceLike {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  databases: Record<string, Database>;
}

export function searchWorkspace(ws: WorkspaceLike, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const boardTitle = (id: string) => ws.boards[id]?.title ?? "Papan";

  // Papan (judul) → membuka papannya.
  for (const b of Object.values(ws.boards)) {
    if (b.title.toLowerCase().includes(q)) {
      hits.push({
        kind: "board",
        id: b.id,
        boardTitle: b.parentBoardId ? boardTitle(b.parentBoardId) : "—",
        typeLabel: "Papan",
        label: b.title || "Tanpa judul",
        snippet: b.title,
      });
    }
  }

  // Elemen → loncat ke kartunya. BOARD_REF & IMAGE dilewati (judul papan sudah
  // tercakup di atas; gambar tak punya teks).
  for (const el of Object.values(ws.elements)) {
    let text = "";
    let label = "";
    let typeLabel = "";
    if (el.type === "NOTE") {
      text = htmlToText(el.content.html);
      label = text || "Catatan kosong";
      typeLabel = "Catatan";
    } else if (el.type === "TASK_LIST") {
      const items = el.content.items.map((i) => i.text).join(" ");
      text = `${el.content.title} ${items}`.trim();
      label = el.content.title || "Daftar tugas";
      typeLabel = "Tugas";
    } else if (el.type === "LINK") {
      const c = el.content;
      text = [c.title, c.description, c.siteName, c.url].filter(Boolean).join(" ");
      label = c.title || c.url || "Tautan";
      typeLabel = "Tautan";
    } else if (el.type === "DATABASE_REF") {
      const db = ws.databases[el.content.databaseId];
      if (!db) continue;
      const cells = db.rows
        .flatMap((r) => Object.values(r.cells))
        .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
        .map(String)
        .join(" ");
      const cols = db.columns.map((col) => col.name).join(" ");
      text = `${db.title} ${cols} ${cells}`.trim();
      label = db.title || "Database";
      typeLabel = "Database";
    } else {
      continue; // BOARD_REF, IMAGE, CONNECTOR
    }

    if (text.toLowerCase().includes(q)) {
      hits.push({
        kind: "element",
        id: el.id,
        boardTitle: boardTitle(el.boardId),
        typeLabel,
        label: label.slice(0, 80),
        snippet: snippetAround(text, q),
      });
    }
  }

  return hits.slice(0, MAX_HITS);
}
