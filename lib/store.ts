"use client";

import { create } from "zustand";
import {
  DEFAULT_CAMERA,
  ROOT_BOARD_ID,
  type Board,
  type BoardElement,
  type Camera,
  type CardElement,
  type ClipboardPayload,
  type LinkElement,
  type TaskListElement,
} from "./types";

const STORAGE_KEY = "milnote:workspace:v1";
const NOTE_WIDTH = 248;
const BOARD_CARD_WIDTH = 200;
const TASK_LIST_WIDTH = 260;
const LINK_WIDTH = 240;

export interface Persisted {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  cameras: Record<string, Camera>;
  currentBoardId: string;
}

/** Bentuk yang disimpan & dikirim ke cloud — satu sumber kebenaran untuk
 *  localStorage maupun sync, supaya keduanya tidak pernah berbeda. */
export function snapshot(s: CanvasState): Persisted {
  return {
    boards: s.boards,
    elements: s.elements,
    cameras: { ...s.cameras, [s.currentBoardId]: s.camera },
    currentBoardId: s.currentBoardId,
  };
}

interface CanvasState extends Persisted {
  selectedIds: string[];
  editingId: string | null;
  camera: Camera; // kamera papan yang sedang dibuka
  hydrated: boolean;

  hydrate: () => void;
  /** Ganti seluruh isi workspace — dipakai saat mengambil versi dari cloud. */
  replaceWorkspace: (data: Persisted) => void;
  /** Pulihkan boards+elements dari snapshot undo/redo, tanpa menyentuh kamera. */
  applyHistory: (snap: { boards: Record<string, Board>; elements: Record<string, BoardElement>; currentBoardId: string }) => void;
  setCamera: (camera: Camera) => void;
  addNote: (worldX: number, worldY: number) => string;
  addBoard: (worldX: number, worldY: number) => string;
  addTaskList: (worldX: number, worldY: number) => string;
  addLink: (worldX: number, worldY: number) => string;
  resolveLink: (id: string, url: string) => Promise<void>;
  addConnector: (sourceElementId: string, targetElementId: string) => string | null;
  setTaskListTitle: (id: string, title: string) => void;
  addTaskItem: (id: string, afterItemId?: string) => string | null;
  setTaskText: (id: string, itemId: string, text: string) => void;
  toggleTask: (id: string, itemId: string) => void;
  removeTaskItem: (id: string, itemId: string) => void;
  openBoard: (boardId: string) => void;
  renameBoard: (boardId: string, title: string) => void;
  moveElement: (id: string, x: number, y: number) => void;
  /** Geser banyak elemen sekaligus dalam satu update — dipakai group drag,
   *  supaya jadi satu langkah undo & satu kiriman sync, bukan N. */
  moveMany: (updates: { id: string; x: number; y: number }[]) => void;
  updateContent: (id: string, html: string) => void;
  removeElement: (id: string) => void;
  /** Hapus banyak elemen sekaligus (group delete), dengan kaskade yang sama. */
  removeMany: (ids: string[]) => void;
  /** additive = shift/ctrl-click: toggle keanggotaan, bukan mengganti seleksi. */
  select: (id: string | null, additive?: boolean) => void;
  /** Ganti seluruh himpunan terpilih sekaligus — dipakai marquee. */
  setSelection: (ids: string[]) => void;
  /** Tempelkan potongan papan-klip ke sebuah papan dengan id baru untuk semua
   *  elemen & papan (deep clone), lalu pilih kartu hasil tempelan. */
  pasteElements: (payload: ClipboardPayload, targetBoardId: string, offset: { x: number; y: number }) => string[];
  setEditing: (id: string | null) => void;
  bringToFront: (id: string) => void;
}

const rootBoard: Board = { id: ROOT_BOARD_ID, title: "Home", parentBoardId: null };

type SetState = (fn: (s: CanvasState) => Partial<CanvasState>) => void;

/** Pembungkus umum untuk mengubah isi TASK_LIST — menjaga guard tipe &
 *  updatedAt tetap konsisten di semua aksi. */
function updateTaskList(
  set: SetState,
  id: string,
  fn: (content: TaskListElement["content"]) => TaskListElement["content"]
) {
  set((s) => {
    const el = s.elements[id];
    if (!el || el.type !== "TASK_LIST") return s;
    return {
      elements: {
        ...s.elements,
        [id]: { ...el, content: fn(el.content), updatedAt: Date.now() },
      },
    };
  });
}

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

/** Buang sekumpulan elemen dari salinan kerja, dengan kaskade:
 *  - kartu papan → papannya + seluruh keturunannya + isinya ikut hilang;
 *  - konektor yang salah satu ujungnya lenyap dipangkas di akhir.
 *  Dipakai bersama oleh removeElement & removeMany supaya aturannya satu. */
function removeElements(
  boards: Record<string, Board>,
  elements: Record<string, BoardElement>,
  cameras: Record<string, Camera>,
  ids: string[]
): { boards: Record<string, Board>; elements: Record<string, BoardElement>; cameras: Record<string, Camera> } {
  const nb = { ...boards };
  const ne = { ...elements };
  const nc = { ...cameras };

  for (const id of ids) {
    const el = ne[id];
    if (!el) continue;
    delete ne[id];
    if (el.type === "BOARD_REF") {
      const doomed = collectDescendants(nb, el.content.boardId);
      for (const bid of doomed) {
        delete nb[bid];
        delete nc[bid];
        for (const e of Object.values(ne)) {
          if (e.boardId === bid) delete ne[e.id];
        }
      }
    }
  }

  for (const e of Object.values(ne)) {
    if (e.type === "CONNECTOR" && (!ne[e.sourceElementId] || !ne[e.targetElementId])) {
      delete ne[e.id];
    }
  }

  return { boards: nb, elements: ne, cameras: nc };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boards: { [ROOT_BOARD_ID]: rootBoard },
  elements: {},
  cameras: {},
  currentBoardId: ROOT_BOARD_ID,
  selectedIds: [],
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

  replaceWorkspace: (data) => {
    const boards: Record<string, Board> = { [ROOT_BOARD_ID]: rootBoard, ...data.boards };
    const currentBoardId = boards[data.currentBoardId] ? data.currentBoardId : ROOT_BOARD_ID;
    set({
      boards,
      elements: data.elements ?? {},
      cameras: data.cameras ?? {},
      currentBoardId,
      camera: data.cameras?.[currentBoardId] ?? DEFAULT_CAMERA,
      selectedIds: [],
      editingId: null,
    });
  },

  applyHistory: (snap) =>
    set((s) => {
      const boards: Record<string, Board> = { [ROOT_BOARD_ID]: rootBoard, ...snap.boards };
      // Papan yang sedang dibuka mungkin ikut terhapus oleh langkah yang
      // dipulihkan → jatuh ke root supaya kanvas tidak menampilkan papan hantu.
      const currentBoardId = boards[snap.currentBoardId] ? snap.currentBoardId : ROOT_BOARD_ID;
      const sameBoard = currentBoardId === s.currentBoardId;
      return {
        boards,
        elements: snap.elements,
        currentBoardId,
        camera: sameBoard ? s.camera : s.cameras[currentBoardId] ?? DEFAULT_CAMERA,
        selectedIds: [],
        editingId: null,
      };
    }),

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
      selectedIds: [id],
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
      selectedIds: [elementId],
    }));
    return elementId;
  },

  addTaskList: (worldX, worldY) => {
    const id = crypto.randomUUID();
    set((s) => ({
      elements: {
        ...s.elements,
        [id]: {
          id,
          boardId: s.currentBoardId,
          type: "TASK_LIST",
          x: worldX - TASK_LIST_WIDTH / 2,
          y: worldY - 30,
          width: TASK_LIST_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: {
            title: "",
            items: [{ id: crypto.randomUUID(), text: "", done: false }],
          },
          updatedAt: Date.now(),
        },
      },
      selectedIds: [id],
    }));
    return id;
  },

  setTaskListTitle: (id, title) => updateTaskList(set, id, (c) => ({ ...c, title })),

  addTaskItem: (id, afterItemId) => {
    const el = get().elements[id];
    if (!el || el.type !== "TASK_LIST") return null;
    const newId = crypto.randomUUID();
    updateTaskList(set, id, (c) => {
      const at = afterItemId ? c.items.findIndex((i) => i.id === afterItemId) : -1;
      const item = { id: newId, text: "", done: false };
      const items = [...c.items];
      items.splice(at < 0 ? items.length : at + 1, 0, item);
      return { ...c, items };
    });
    return newId;
  },

  setTaskText: (id, itemId, text) =>
    updateTaskList(set, id, (c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    })),

  toggleTask: (id, itemId) =>
    updateTaskList(set, id, (c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
    })),

  removeTaskItem: (id, itemId) =>
    updateTaskList(set, id, (c) => ({
      ...c,
      items: c.items.filter((i) => i.id !== itemId),
    })),

  addLink: (worldX, worldY) => {
    const id = crypto.randomUUID();
    set((s) => ({
      elements: {
        ...s.elements,
        [id]: {
          id,
          boardId: s.currentBoardId,
          type: "LINK",
          x: worldX - LINK_WIDTH / 2,
          y: worldY - 30,
          width: LINK_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { url: "", state: "empty" },
          updatedAt: Date.now(),
        },
      },
      selectedIds: [id],
    }));
    return id;
  },

  resolveLink: async (id, rawUrl) => {
    const url = rawUrl.trim().match(/^https?:\/\//i) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    const patch = (content: LinkElement["content"]) =>
      set((s) => {
        const el = s.elements[id];
        if (!el || el.type !== "LINK") return s;
        return { elements: { ...s.elements, [id]: { ...el, content, updatedAt: Date.now() } } };
      });

    patch({ url, state: "pending" });
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "gagal");
      patch({
        url: data.url ?? url,
        title: data.title,
        description: data.description,
        image: data.image,
        siteName: data.siteName,
        state: "ready",
      });
    } catch {
      // Tautannya tetap berguna walau pratinjaunya gagal — jangan buang.
      patch({ url, state: "failed" });
    }
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
        selectedIds: [],
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

  moveMany: (updates) =>
    set((s) => {
      const elements = { ...s.elements };
      const now = Date.now();
      for (const u of updates) {
        const el = elements[u.id];
        if (!el || el.type === "CONNECTOR") continue;
        elements[u.id] = { ...el, x: u.x, y: u.y, updatedAt: now };
      }
      return { elements };
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
      if (!s.elements[id]) return s;
      const { boards, elements, cameras } = removeElements(s.boards, s.elements, s.cameras, [id]);
      return {
        elements,
        boards,
        cameras,
        selectedIds: s.selectedIds.filter((x) => elements[x]),
        editingId: s.editingId && elements[s.editingId] ? s.editingId : null,
      };
    }),

  removeMany: (ids) =>
    set((s) => {
      if (!ids.some((id) => s.elements[id])) return s;
      const { boards, elements, cameras } = removeElements(s.boards, s.elements, s.cameras, ids);
      return {
        elements,
        boards,
        cameras,
        selectedIds: s.selectedIds.filter((x) => elements[x]),
        editingId: s.editingId && elements[s.editingId] ? s.editingId : null,
      };
    }),

  select: (id, additive = false) =>
    set((s) => {
      if (id === null) return { selectedIds: [] };
      if (additive) {
        return {
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    }),

  setSelection: (ids) => set({ selectedIds: ids }),

  pasteElements: (payload, targetBoardId, offset) => {
    let newTopIds: string[] = [];
    set((s) => {
      // Id baru untuk tiap papan & elemen yang disalin.
      const boardIdMap = new Map<string, string>();
      for (const bid of Object.keys(payload.boards)) boardIdMap.set(bid, crypto.randomUUID());
      const elIdMap = new Map<string, string>();
      for (const eid of Object.keys(payload.elements)) elIdMap.set(eid, crypto.randomUUID());

      const boards = { ...s.boards };
      for (const [oldId, b] of Object.entries(payload.boards)) {
        const nid = boardIdMap.get(oldId)!;
        boards[nid] = {
          ...b,
          id: nid,
          // Papan bersarang → petakan ke induk barunya. Papan yang ditunjuk
          // langsung oleh kartu tempelan kini "tinggal" di papan tujuan.
          parentBoardId:
            b.parentBoardId && boardIdMap.has(b.parentBoardId)
              ? boardIdMap.get(b.parentBoardId)!
              : targetBoardId,
        };
      }

      const elements = { ...s.elements };
      let z = nextZIndex(s.elements, targetBoardId);
      const now = Date.now();
      const tops: string[] = [];

      for (const [oldId, el] of Object.entries(payload.elements)) {
        const nid = elIdMap.get(oldId)!;
        // Elemen di papan turunan yang ikut dikloning vs kartu tingkat-atas
        // (yang mendarat di papan tujuan).
        const onClonedBoard = boardIdMap.has(el.boardId);
        const boardId = onClonedBoard ? boardIdMap.get(el.boardId)! : targetBoardId;

        if (el.type === "CONNECTOR") {
          const src = elIdMap.get(el.sourceElementId);
          const tgt = elIdMap.get(el.targetElementId);
          if (!src || !tgt) continue; // salah satu ujung tak ikut tersalin
          elements[nid] = { ...el, id: nid, boardId, sourceElementId: src, targetElementId: tgt, updatedAt: now };
          continue;
        }

        const cloned = {
          ...el,
          id: nid,
          boardId,
          updatedAt: now,
          content: structuredClone(el.content),
        } as CardElement;
        if (cloned.type === "BOARD_REF" && el.type === "BOARD_REF") {
          cloned.content = { boardId: boardIdMap.get(el.content.boardId) ?? el.content.boardId };
        }
        if (!onClonedBoard) {
          cloned.x = el.x + offset.x;
          cloned.y = el.y + offset.y;
          cloned.zIndex = z++;
          tops.push(nid);
        }
        elements[nid] = cloned;
      }

      newTopIds = tops;
      return { boards, elements, selectedIds: tops };
    });
    return newTopIds;
  },

  setEditing: (id) =>
    set((s) => ({ editingId: id, selectedIds: id ? [id] : s.selectedIds })),

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(state)));
    } catch {
      // quota penuh dsb — biarkan, jangan ganggu interaksi
    }
  }, 400);
});
