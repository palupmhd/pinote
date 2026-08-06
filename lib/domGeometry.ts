"use client";

/** Jembatan DOM ↔ geometri: hal-hal yang butuh MEMBACA layout kartu yang
 *  sudah dirender (tinggi kartu tak ada di data model — ikut isi), jadi tak
 *  bisa tinggal di `geometry.ts` yang sengaja murni & bisa diuji di Node.
 *
 *  Sebelum ada modul ini, pola `document.querySelector("[data-element-id=…]")`
 *  disalin di 10 tempat dan konstanta tinggi-cadangan 64 dideklarasikan ulang
 *  di 4 komponen — satu-satunya cara memastikan semuanya tetap sepakat adalah
 *  mengingat untuk mengubah kesepuluhnya bareng. */

import { cardVisualBox, type Point } from "./geometry";
import { MIN_CARD_HEIGHT } from "./types";
import type { BoardElement, Box } from "./types";

/** Tinggi permukaan yang dipakai kalau node kartunya belum ada di DOM (mis.
 *  render pertama, atau kartu di papan yang belum tampil). Cuma tebakan kasar
 *  supaya garis/titik tidak melompat ke 0 — bukan angka yang punya makna. */
export const CARD_FALLBACK_HEIGHT = 64;

/** Node DOM kartu, dicari lewat atribut `data-element-id` yang dipasang tiap
 *  komponen kartu di div terluarnya. null kalau belum/tak dirender. */
export const cardNode = (elementId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);

/** Kotak permukaan kartu yang SUNGGUH terlihat, tingginya diukur dari DOM.
 *  `override` (opsional) memakai posisi live saat kartu sedang digeser —
 *  store belum di-update tiap frame, jadi `el.x`/`el.y` masih posisi lama. */
export function cardBoxFromDom(
  el: { id: string; x: number; y: number; width: number },
  override?: Point,
  fallbackVisualHeight: number = CARD_FALLBACK_HEIGHT
): Box {
  return cardVisualBox(
    { x: override?.x ?? el.x, y: override?.y ?? el.y, width: el.width },
    cardNode(el.id),
    fallbackVisualHeight
  );
}

/** Kotak visual SEMUA kartu lain di satu papan — sumber "kartu lain" untuk
 *  smart-guide, dipakai bareng oleh drag posisi (useElementDrag) dan resize
 *  (ResizeHandle). Keduanya memanggil ini SEKALI di pointerdown, bukan tiap
 *  frame: kartu-kartu itu diam sepanjang gestur, jadi kotaknya tak pernah
 *  berubah — sekaligus menghindari `offsetHeight` (yang memaksa layout) atas
 *  semua kartu papan di tiap pointermove. */
export function otherCardBoxes(
  elements: Record<string, BoardElement>,
  boardId: string,
  excludeIds: Set<string>
): Box[] {
  const boxes: Box[] = [];
  for (const el of Object.values(elements)) {
    if (el.type === "CONNECTOR" || el.boardId !== boardId || excludeIds.has(el.id)) continue;
    boxes.push(cardBoxFromDom(el, undefined, MIN_CARD_HEIGHT));
  }
  return boxes;
}

/** Koordinat layar → koordinat dunia. `getBoundingClientRect` world-layer
 *  sudah memuat translate kamera, jadi cukup dibagi zoom — tak perlu membaca
 *  posisi kamera terpisah. */
export function worldPointFromClient(clientX: number, clientY: number, zoom: number): Point {
  const rect = document.getElementById("world-layer")?.getBoundingClientRect();
  return { x: (clientX - (rect?.left ?? 0)) / zoom, y: (clientY - (rect?.top ?? 0)) / zoom };
}
