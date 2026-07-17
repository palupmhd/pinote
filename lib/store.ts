"use client";

import { create } from "zustand";
import {
  DEFAULT_CAMERA,
  ROOT_BOARD_ID,
  type Board,
  type BoardElement,
  type Camera,
} from "./types";

const STORAGE_KEY = "milnote:workspace:v1";
const NOTE_WIDTH = 248;
const BOARD_CARD_WIDTH = 200;

interface Persisted {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  cameras: Record<string, Camera>;
  currentBoardId: string;
}

interface CanvasState extends Persisted {
  selectedId: string | null;
  editingId: string | null;
  camera: Camera; // kamera papan yang sedang dibuka
  hydrated: boolean;

  hydrate: () => void;
  setCamera: (camera: Camera) => void;
  addNote: (worldX: number, worldY: number) => string;
  addBoard: (worldX: number, worldY: number) => string;
  addConnector: (sourceElementId: string, targetElementId: string) => string | null;
  openBoard: (boardId: string) => void;
  renameBoard: (boardId: string, title: string) => void;
  moveElement: (id: string, x: number, y: number) => void;
  updateContent: (id: string, html: string) => void;
  removeElement: (id: string) => void;
  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  bringToFront: (id: string) => void;
}

const rootBoard: Board = { id: ROOT_BOARD_ID, title: "Home", parentBoardId: null };

function nextZIndex(elements: Record<string, BoardElement>, boardId: string): number {
  const zs = Object.values(elements)
    .filter((e) => e.boardId === boardId && e.type !== "CONNECTOR")
    .map((e) => e.zIndex);
  return zs.length ? Math.max(...zs) + 1 : 1;
}

/** Board + seluruh keturunannya — dipakai saat menghapus kartu papan supaya
 *  isinya tidak jadi data menggantung. */
function collectDescendants(boards: Record<string, Board>, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of Object.values(boards)) {
      if (b.parentBoardId && ids.has(b.parentBoardId) && !ids.has(b.id)) {
        ids.add(b.id);
        grew = true;
      }
    }
  }
  return ids;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boards: { [ROOT_BOARD_ID]: rootBoard },
  elements: {},
  cameras: {},
  currentBoardId: ROOT_BOARD_ID,
  selectedId: null,
  editingId: null,
  camera: DEFAULT_CAMERA,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<Persisted>;
        const boards: Record<string, Board> = {
          [ROOT_BOARD_ID]: rootBoard,
          ...(data.boards ?? {}),
        };
        const currentBoardId =
          data.currentBoardId && boards[data.currentBoardId]
            ? data.currentBoardId
            : ROOT_BOARD_ID;
        set({
          boards,
          elements: data.elements ?? {},
          cameras: data.cameras ?? {},
          currentBoardId,
          camera: data.cameras?.[currentBoardId] ?? DEFAULT_CAMERA,
          hydrated: true,
        });
        return;
      }
    } catch {
      // data korup / format lama → mulai bersih, jangan crash
    }
    set({ hydrated: true });
  },

  setCamera: (camera) =>
    set((s) => ({ camera, cameras: { ...s.cameras, [s.currentBoardId]: camera } })),

  addNote: (worldX, worldY) => {
    const id = crypto.randomUUID();
    set((s) => ({
      elements: {
        ...s.elements,
        [id]: {
          id,
          boardId: s.currentBoardId,
          type: "NOTE",
          x: worldX - NOTE_WIDTH / 2,
          y: worldY - 20,
          width: NOTE_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { html: "" },
          updatedAt: Date.now(),
        },
      },
      selectedId: id,
      editingId: id,
    }));
    return id;
  },

  addBoard: (worldX, worldY) => {
    const elementId = crypto.randomUUID();
    const newBoardId = crypto.randomUUID();
    set((s) => ({
      boards: {
        ...s.boards,
        [newBoardId]: {
          id: newBoardId,
          title: "Papan baru",
          parentBoardId: s.currentBoardId,
        },
      },
      elements: {
        ...s.elements,
        [elementId]: {
          id: elementId,
          boardId: s.currentBoardId,
          type: "BOARD_REF",
          x: worldX - BOARD_CARD_WIDTH / 2,
          y: worldY - 30,
          width: BOARD_CARD_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { boardId: newBoardId },
          updatedAt: Date.now(),
        },
      },
      selectedId: elementId,
    }));
    return elementId;
  },

  addConnector: (sourceElementId, targetElementId) => {
    if (sourceElementId === targetElementId) return null;
    const s = get();
    const src = s.elements[sourceElementId];
    const dst = s.elements[targetElementId];
    if (!src || !dst || src.boardId !== dst.boardId) return null;
    // jangan bikin garis ganda antara pasangan yang sama (arah bebas)
    const exists = Object.values(s.elements).some(
      (e) =>
        e.type === "CONNECTOR" &&
        ((e.sourceElementId === sourceElementId && e.targetElementId === targetElementId) ||
          (e.sourceElementId === targetElementId && e.targetElementId === sourceElementId))
    );
    if (exists) return null;

    const id = crypto.randomUUID();
    set((st) => ({
      elements: {
        ...st.elements,
        [id]: {
          id,
          boardId: src.boardId,
          type: "CONNECTOR",
          sourceElementId,
          targetElementId,
          zIndex: 0, // selalu di bawah kartu
          updatedAt: Date.now(),
        },
      },
    }));
    return id;
  },

  openBoard: (boardId) =>
    set((s) => {
      if (!s.boards[boardId] || boardId === s.currentBoardId) return s;
      const cameras = { ...s.cameras, [s.currentBoardId]: s.camera };
      return {
        cameras,
        currentBoardId: boardId,
        camera: cameras[boardId] ?? DEFAULT_CAMERA,
        selectedId: null,
        editingId: null,
      };
    }),

  renameBoard: (boardId, title) =>
    set((s) => {
      const b = s.boards[boardId];
      if (!b || b.title === title) return s;
      return { boards: { ...s.boards, [boardId]: { ...b, title } } };
    }),

  moveElement: (id, x, y) =>
    set((s) => {
      const el = s.elements[id];
      if (!el || el.type === "CONNECTOR") return s; // konektor tak punya posisi sendiri
      return {
        elements: { ...s.elements, [id]: { ...el, x, y, updatedAt: Date.now() } },
      };
    }),

  updateContent: (id, html) =>
    set((s) => {
      const el = s.elements[id];
      if (!el || el.type !== "NOTE" || el.content.html === html) return s;
      return {
        elements: {
          ...s.elements,
          [id]: { ...el, content: { html }, updatedAt: Date.now() },
        },
      };
    }),

  removeElement: (id) =>
    set((s) => {
      const el = s.elements[id];
      if (!el) return s;

      const elements = { ...s.elements };
      const boards = { ...s.boards };
      const cameras = { ...s.cameras };
      delete elements[id];

      // Hapus kartu papan = hapus papannya beserta seluruh isinya.
      if (el.type === "BOARD_REF") {
        const doomed = collectDescendants(s.boards, el.content.boardId);
        for (const bid of doomed) {
          delete boards[bid];
          delete cameras[bid];
          for (const e of Object.values(elements)) {
            if (e.boardId === bid) delete elements[e.id];
          }
        }
      }

      // Konektor yang salah satu ujungnya sudah tidak ada ikut dibuang.
      for (const e of Object.values(elements)) {
        if (
          e.type === "CONNECTOR" &&
          (!elements[e.sourceElementId] || !elements[e.targetElementId])
        ) {
          delete elements[e.id];
        }
      }

      return {
        elements,
        boards,
        cameras,
        selectedId: s.selectedId === id ? null : s.selectedId,
        editingId: s.editingId === id ? null : s.editingId,
      };
    }),

  select: (id) => set({ selectedId: id }),

  setEditing: (id) => set({ editingId: id, selectedId: id ?? get().selectedId }),

  bringToFront: (id) =>
    set((s) => {
      const el = s.elements[id];
      if (!el || el.type === "CONNECTOR") return s;
      const top = nextZIndex(s.elements, el.boardId);
      if (el.zIndex === top - 1) return s;
      return { elements: { ...s.elements, [id]: { ...el, zIndex: top } } };
    }),
}));

/** Jalur dari root ke papan yang sedang dibuka — untuk breadcrumb.
 *  Helper biasa, BUKAN selector zustand: hasilnya array baru tiap panggil, jadi
 *  kalau dipakai langsung sebagai selector akan memicu render loop. Panggil ini
 *  di dalam useMemo. */
export function breadcrumbPath(
  boards: Record<string, Board>,
  currentBoardId: string
): Board[] {
  const path: Board[] = [];
  let cur: Board | undefined = boards[currentBoardId];
  while (cur) {
    path.unshift(cur);
    cur = cur.parentBoardId ? boards[cur.parentBoardId] : undefined;
  }
  return path;
}

// Autosave: debounce ke localStorage. Nanti diganti/didampingi adapter Supabase
// (Last-Write-Wins via updatedAt) tanpa mengubah pemanggil.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useCanvasStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const payload: Persisted = {
        boards: state.boards,
        elements: state.elements,
        cameras: { ...state.cameras, [state.currentBoardId]: state.camera },
        currentBoardId: state.currentBoardId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota penuh dsb — biarkan, jangan ganggu interaksi
    }
  }, 400);
});
