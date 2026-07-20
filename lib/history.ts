"use client";

import { create } from "zustand";
import { useCanvasStore } from "./store";
import type { Board, BoardElement } from "./types";

/** Undo/redo untuk dokumen (boards + elements). Sengaja TIDAK menyertakan
 *  kamera, seleksi, atau papan yang sedang dibuka — membatalkan sebuah pan/zoom
 *  atau perpindahan papan itu mengagetkan, bukan yang orang harapkan dari Ctrl+Z.
 *
 *  Snapshot menyimpan referensi objek apa adanya: store selalu meng-update
 *  secara immutable (spread), jadi objek lama tak pernah dimutasi di tempat —
 *  menyimpan referensinya aman dan murah, tak perlu deep-clone. */
interface Snapshot {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  /** Disimpan hanya untuk mengembalikan konteks papan bila board terpilih ikut
   *  terhapus/terpulihkan — bukan pemicu masuknya sebuah langkah undo. */
  currentBoardId: string;
}

const MAX_DEPTH = 100;
/** Edit teks beruntun dalam jendela ini menyatu jadi satu langkah undo, supaya
 *  mengetik satu kata tidak jadi sepuluh langkah. Perubahan struktural
 *  (tambah/hapus elemen) selalu jadi langkah tersendiri, apa pun jedanya. */
const COALESCE_MS = 500;

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let lastRecordTs = 0;

/** Saat sedang menerapkan undo/redo (atau memulihkan dari cloud), perubahan
 *  store yang dihasilkan jangan ikut terekam sebagai langkah baru. */
let suspended = false;

/** Store kecil khusus status tombol — dipisah dari data supaya menekan tombol
 *  tidak memaksa render ulang seluruh kanvas. */
export const useHistoryStore = create<{ canUndo: boolean; canRedo: boolean }>(() => ({
  canUndo: false,
  canRedo: false,
}));

const publish = () =>
  useHistoryStore.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });

const snap = (): Snapshot => {
  const s = useCanvasStore.getState();
  return { boards: s.boards, elements: s.elements, currentBoardId: s.currentBoardId };
};

/** Jalankan fn tanpa merekamnya ke riwayat (dipakai saat menerapkan undo/redo
 *  maupun saat sync memasang data dari cloud). */
export function suspendHistory<T>(fn: () => T): T {
  const prev = suspended;
  suspended = true;
  try {
    return fn();
  } finally {
    suspended = prev;
  }
}

/** Buang seluruh riwayat — dipanggil setelah data diganti dari cloud, karena
 *  membatalkan melewati titik sinkronisasi bisa menimpa kerja perangkat lain. */
export function clearHistory() {
  past = [];
  future = [];
  lastRecordTs = 0;
  publish();
}

export function undo() {
  if (!past.length) return;
  const target = past.pop()!;
  future.push(snap());
  if (future.length > MAX_DEPTH) future.shift();
  suspendHistory(() => useCanvasStore.getState().applyHistory(target));
  lastRecordTs = 0; // paksa edit berikutnya jadi langkah baru, bukan menyatu
  publish();
}

export function redo() {
  if (!future.length) return;
  const target = future.pop()!;
  past.push(snap());
  if (past.length > MAX_DEPTH) past.shift();
  suspendHistory(() => useCanvasStore.getState().applyHistory(target));
  lastRecordTs = 0;
  publish();
}

/** Mulai merekam perubahan dokumen. Panggil sekali (mis. di Canvas) setelah
 *  hydrate; mengembalikan pelepas langganan. */
export function startHistory(): () => void {
  return useCanvasStore.subscribe((state, prev) => {
    if (suspended) return;
    // Lewati transisi hydrate dan perubahan yang bukan dokumen (kamera, seleksi,
    // navigasi papan) — hanya boards/elements yang membentuk langkah undo.
    if (!state.hydrated || !prev.hydrated) return;
    const boardsChanged = state.boards !== prev.boards;
    const elementsChanged = state.elements !== prev.elements;
    if (!boardsChanged && !elementsChanged) return;

    // Struktural = jumlah entri berubah (tambah/hapus). Ini selalu langkah
    // tersendiri; edit isi (jumlah sama) boleh menyatu bila beruntun cepat.
    const structural =
      Object.keys(state.elements).length !== Object.keys(prev.elements).length ||
      Object.keys(state.boards).length !== Object.keys(prev.boards).length;

    const now = Date.now();
    const coalesce = !structural && now - lastRecordTs < COALESCE_MS;
    lastRecordTs = now;
    if (coalesce) return; // baseline sebelum burst sudah tersimpan

    past.push({ boards: prev.boards, elements: prev.elements, currentBoardId: prev.currentBoardId });
    if (past.length > MAX_DEPTH) past.shift();
    future = []; // edit baru mematikan jalur redo
    publish();
  });
}
