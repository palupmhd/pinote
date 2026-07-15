"use client";

import { create } from "zustand";
import type { BoardElement, Camera } from "./types";

const STORAGE_KEY = "milnote:board:root";
const NOTE_WIDTH = 248;

interface CanvasState {
  elements: Record<string, BoardElement>;
  selectedId: string | null;
  editingId: string | null;
  camera: Camera;
  hydrated: boolean;

  hydrate: () => void;
  setCamera: (camera: Camera) => void;
  addNote: (worldX: number, worldY: number) => string;
  moveElement: (id: string, x: number, y: number) => void;
  updateContent: (id: string, html: string) => void;
  removeElement: (id: string) => void;
  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  bringToFront: (id: string) => void;
}

function nextZIndex(elements: Record<string, BoardElement>): number {
  const zs = Object.values(elements).map((e) => e.zIndex);
  return zs.length ? Math.max(...zs) + 1 : 1;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: {},
  selectedId: null,
  editingId: null,
  camera: { x: 0, y: 0, zoom: 1 },
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          elements: Record<string, BoardElement>;
          camera?: Camera;
        };
        set({
          elements: data.elements ?? {},
          camera: data.camera ?? { x: 0, y: 0, zoom: 1 },
          hydrated: true,
        });
        return;
      }
    } catch {
      // data korup → mulai kosong, jangan crash
    }
    set({ hydrated: true });
  },

  setCamera: (camera) => set({ camera }),

  addNote: (worldX, worldY) => {
    const id = crypto.randomUUID();
    set((s) => ({
      elements: {
        ...s.elements,
        [id]: {
          id,
          type: "NOTE",
          x: worldX - NOTE_WIDTH / 2,
          y: worldY - 20,
          width: NOTE_WIDTH,
          zIndex: nextZIndex(s.elements),
          content: { html: "" },
          updatedAt: Date.now(),
        },
      },
      selectedId: id,
      editingId: id,
    }));
    return id;
  },

  moveElement: (id, x, y) =>
    set((s) => {
      const el = s.elements[id];
      if (!el) return s;
      return {
        elements: { ...s.elements, [id]: { ...el, x, y, updatedAt: Date.now() } },
      };
    }),

  updateContent: (id, html) =>
    set((s) => {
      const el = s.elements[id];
      if (!el || el.content.html === html) return s;
      return {
        elements: {
          ...s.elements,
          [id]: { ...el, content: { html }, updatedAt: Date.now() },
        },
      };
    }),

  removeElement: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.elements;
      return {
        elements: rest,
        selectedId: s.selectedId === id ? null : s.selectedId,
        editingId: s.editingId === id ? null : s.editingId,
      };
    }),

  select: (id) => set({ selectedId: id }),

  setEditing: (id) => set({ editingId: id, selectedId: id ?? get().selectedId }),

  bringToFront: (id) =>
    set((s) => {
      const el = s.elements[id];
      if (!el) return s;
      const top = nextZIndex(s.elements);
      if (el.zIndex === top - 1) return s;
      return { elements: { ...s.elements, [id]: { ...el, zIndex: top } } };
    }),
}));

// Autosave: debounce ke localStorage. Nanti diganti/didampingi adapter Supabase
// (Last-Write-Wins via updatedAt) tanpa mengubah pemanggil.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useCanvasStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ elements: state.elements, camera: state.camera })
      );
    } catch {
      // quota penuh dsb — biarkan, jangan ganggu interaksi
    }
  }, 400);
});
