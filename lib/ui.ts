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
}>((set) => ({
  agendaOpen: false,
  setAgenda: (v) => set({ agendaOpen: v }),
  toggleAgenda: () => set((s) => ({ agendaOpen: !s.agendaOpen })),
  openDatabaseId: null,
  openDatabase: (id) => set({ openDatabaseId: id }),
  closeDatabase: () => set({ openDatabaseId: null }),
}));
