"use client";

import { useCanvasStore } from "./store";
import type {
  Board,
  BoardElement,
  CardElement,
  ClipboardPayload,
  Database,
} from "./types";

/** Papan-klip in-app (bukan clipboard OS): copy menyimpan potongan graf di sini,
 *  paste menempelkannya. Cukup untuk menyalin antar-papan dalam satu sesi. */
let clipboard: ClipboardPayload | null = null;
/** Tiap paste beruntun digeser sedikit lebih jauh supaya salinannya tidak
 *  bertumpuk persis di atas yang sebelumnya. */
let pasteRun = 0;
const STEP = 24;

type StoreState = ReturnType<typeof useCanvasStore.getState>;

/** Kumpulkan sebuah papan beserta seluruh isinya (rekursif ke papan bersarang)
 *  ke dalam payload — supaya menyalin kartu papan ikut membawa isinya. */
function collectBoardSubtree(
  state: StoreState,
  boardId: string,
  boards: Record<string, Board>,
  elements: Record<string, BoardElement>
) {
  const board = state.boards[boardId];
  if (!board || boards[boardId]) return; // sudah dikumpulkan / tidak ada
  boards[boardId] = board;
  for (const el of Object.values(state.elements)) {
    if (el.boardId !== boardId) continue;
    elements[el.id] = el;
    if (el.type === "BOARD_REF") {
      collectBoardSubtree(state, el.content.boardId, boards, elements);
    }
  }
}

/** Bangun payload dari sekumpulan id terpilih: kartunya, konektor yang KEDUA
 *  ujungnya ikut terpilih, subpohon papan tiap kartu papan, dan tabel tiap
 *  kartu database (termasuk yang ada di dalam papan yang ikut tersalin). */
export function buildClipboard(state: StoreState, ids: string[]): ClipboardPayload {
  const topCards = ids
    .map((id) => state.elements[id])
    .filter((el): el is CardElement => !!el && el.type !== "CONNECTOR");
  const topIds = new Set(topCards.map((c) => c.id));

  const elements: Record<string, BoardElement> = {};
  const boards: Record<string, Board> = {};
  const databases: Record<string, Database> = {};

  for (const c of topCards) {
    elements[c.id] = c;
    if (c.type === "BOARD_REF") collectBoardSubtree(state, c.content.boardId, boards, elements);
  }

  // Konektor antar kartu yang sama-sama terpilih ikut tersalin.
  for (const el of Object.values(state.elements)) {
    if (el.type === "CONNECTOR" && topIds.has(el.sourceElementId) && topIds.has(el.targetElementId)) {
      elements[el.id] = el;
    }
  }

  // Tarik tabel untuk tiap kartu database yang sudah terkumpul (tingkat-atas
  // maupun di dalam subpohon papan).
  for (const el of Object.values(elements)) {
    if (el.type === "DATABASE_REF") {
      const db = state.databases[el.content.databaseId];
      if (db) databases[db.id] = db;
    }
  }

  return { elements, boards, databases };
}

export function copySelection() {
  const st = useCanvasStore.getState();
  if (!st.selectedIds.length) return;
  clipboard = buildClipboard(st, st.selectedIds);
  pasteRun = 0;
}

export function pasteClipboard() {
  if (!clipboard) return;
  pasteRun += 1;
  const st = useCanvasStore.getState();
  st.pasteElements(clipboard, st.currentBoardId, { x: STEP * pasteRun, y: STEP * pasteRun });
}

/** Salin + tempel dalam satu langkah, di papan yang sama, tanpa mengutak-atik
 *  papan-klip pengguna. */
export function duplicateSelection() {
  const st = useCanvasStore.getState();
  if (!st.selectedIds.length) return;
  const payload = buildClipboard(st, st.selectedIds);
  st.pasteElements(payload, st.currentBoardId, { x: STEP, y: STEP });
}
