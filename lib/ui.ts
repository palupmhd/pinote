"use client";

import { create } from "zustand";

/** State UI sesaat (tidak ikut disimpan/di-sync): mis. panel Agenda terbuka.
 *  Dipisah dari store kanvas supaya membuka panel tidak menandai workspace
 *  "kotor" dan memicu autosave/sync. */
export const useUiStore = create<{
  agendaOpen: boolean;
  setAgenda: (v: boolean) => void;
  toggleAgenda: () => void;
  /** id database yang tabelnya sedang dibuka (overlay editor), atau null. */
  openDatabaseId: string | null;
  openDatabase: (id: string) => void;
  closeDatabase: () => void;
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
  openDatabaseId: null,
  openDatabase: (id) => set({ openDatabaseId: id }),
  closeDatabase: () => set({ openDatabaseId: null }),
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
