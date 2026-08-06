"use client";

import { create } from "zustand";

const SHOW_GRID_KEY = "edenote:showGrid";

// Preferensi tampilan murni per-perangkat (bukan data workspace) — disimpan
// langsung ke localStorage, TIDAK lewat store kanvas/IndexedDB, supaya
// menyalakan/mematikan titik grid tak pernah dianggap "perubahan workspace"
// yang memicu autosave/sync (sama alasannya dengan kenapa store ini sendiri
// dipisah dari canvas store — lihat komentar di bawah).
const readShowGrid = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHOW_GRID_KEY) === "1";
};

/** State UI sesaat (tidak ikut disimpan/di-sync): mis. panel Agenda terbuka.
 *  Dipisah dari store kanvas supaya membuka panel tidak menandai workspace
 *  "kotor" dan memicu autosave/sync. */
export const useUiStore = create<{
  agendaOpen: boolean;
  setAgenda: (v: boolean) => void;
  toggleAgenda: () => void;
  /** Titik grid kanvas: gaya "Gridlines" Excel — mati secara default (tak
   *  mengganggu mata), bisa dinyalakan lewat kontrol zoom. Diingat per
   *  perangkat lewat localStorage (lihat readShowGrid). */
  showGrid: boolean;
  toggleGrid: () => void;
  /** id database yang tabelnya sedang dibuka (overlay editor), atau null. */
  openDatabaseId: string | null;
  openDatabase: (id: string) => void;
  closeDatabase: () => void;
  /** Pencarian lintas papan (spec §6 gap #6). */
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** id konektor yang popover mini-nya (label/warna/gaya) sedang terbuka, atau
   *  null. State sesaat murni — isi konektor sendiri (label/color/style)
   *  tersimpan di canvas store, ini cuma "yang mana lagi terbuka". */
  editingConnectorId: string | null;
  setEditingConnector: (id: string | null) => void;
  /** Presentation Mode (spec §9.2): jalur cerita mengikuti urutan Connector. */
  presenting: boolean;
  presentOrder: string[];
  presentIndex: number;
  startPresentation: (order: string[]) => void;
  exitPresentation: () => void;
  presentNext: () => void;
  presentPrev: () => void;
}>((set) => ({
  agendaOpen: false,
  setAgenda: (v) => set({ agendaOpen: v }),
  toggleAgenda: () => set((s) => ({ agendaOpen: !s.agendaOpen })),
  showGrid: readShowGrid(),
  toggleGrid: () =>
    set((s) => {
      const next = !s.showGrid;
      window.localStorage.setItem(SHOW_GRID_KEY, next ? "1" : "0");
      return { showGrid: next };
    }),
  openDatabaseId: null,
  openDatabase: (id) => set({ openDatabaseId: id }),
  closeDatabase: () => set({ openDatabaseId: null }),
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  editingConnectorId: null,
  setEditingConnector: (id) => set({ editingConnectorId: id }),
  presenting: false,
  presentOrder: [],
  presentIndex: 0,
  startPresentation: (order) =>
    set({ presenting: order.length > 0, presentOrder: order, presentIndex: 0 }),
  exitPresentation: () => set({ presenting: false }),
  presentNext: () =>
    set((s) => ({ presentIndex: Math.min(s.presentIndex + 1, s.presentOrder.length - 1) })),
  presentPrev: () => set((s) => ({ presentIndex: Math.max(s.presentIndex - 1, 0) })),
}));
