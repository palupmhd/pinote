"use client";

import { create } from "zustand";
import { idbGet, idbGetFrom, idbSet } from "./idb";
import type { BoardTemplate } from "./templates";
import {
  DEFAULT_CAMERA,
  INBOX_BOARD_ID,
  ROOT_BOARD_ID,
  type Board,
  type BoardElement,
  type Camera,
  type CardElement,
  type CellValue,
  type ClipboardPayload,
  type ColumnType,
  type Database,
  type DatabaseView,
  type DbColumn,
  type DbRow,
  type LinkElement,
  type TaskListElement,
} from "./types";

const STORAGE_KEY = "milnote:workspace:v1"; // localStorage lama (dibaca sekali utk migrasi)
const LEGACY_IDB_DB = "pinote"; // nama db IndexedDB lama sebelum rename ke "swanote"
const IDB_WORKSPACE_KEY = "workspace"; // kunci di IndexedDB (kapasitas jauh lebih besar)
const NOTE_WIDTH = 248;
const BOARD_CARD_WIDTH = 200;
const TASK_LIST_WIDTH = 260;
const LINK_WIDTH = 240;
const DATABASE_CARD_WIDTH = 220;
const IMAGE_MAX_WIDTH = 320;
const IMAGE_MIN_WIDTH = 140;

export interface Persisted {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  databases: Record<string, Database>;
  cameras: Record<string, Camera>;
  currentBoardId: string;
}

/** Bentuk yang disimpan & dikirim ke cloud — satu sumber kebenaran untuk
 *  localStorage maupun sync, supaya keduanya tidak pernah berbeda. */
export function snapshot(s: CanvasState): Persisted {
  return {
    boards: s.boards,
    elements: s.elements,
    databases: s.databases,
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
  /** Pulihkan boards+elements+databases dari snapshot undo/redo, tanpa kamera. */
  applyHistory: (snap: {
    boards: Record<string, Board>;
    elements: Record<string, BoardElement>;
    databases: Record<string, Database>;
    currentBoardId: string;
  }) => void;
  setCamera: (camera: Camera) => void;
  addNote: (worldX: number, worldY: number) => string;
  /** Tangkapan cepat (spec §9.1): buka Inbox, taruh catatan baru yang menumpuk
   *  rapi, langsung siap diketik — tanpa memilih lokasi dulu. */
  captureToInbox: () => string;
  addBoard: (worldX: number, worldY: number) => string;
  /** Buat papan baru dari template (kartu tertata) lalu langsung membukanya. */
  addBoardFromTemplate: (template: BoardTemplate, worldX: number, worldY: number) => string;
  addTaskList: (worldX: number, worldY: number) => string;
  addLink: (worldX: number, worldY: number) => string;
  addDatabase: (worldX: number, worldY: number) => string;
  /** Taruh kartu pintu baru ke Database yang SUDAH ADA — ini yang bikin satu
   *  database bisa "dipanggil" di board mana pun (spec §7.3/§7.4), beda dari
   *  addDatabase yang bikin database baru. */
  attachDatabase: (databaseId: string, worldX: number, worldY: number) => string | null;
  addImage: (worldX: number, worldY: number, img: { src: string; naturalWidth: number; naturalHeight: number }) => string;
  resolveLink: (id: string, url: string) => Promise<void>;
  addConnector: (sourceElementId: string, targetElementId: string) => string | null;
  setTaskListTitle: (id: string, title: string) => void;
  addTaskItem: (id: string, afterItemId?: string) => string | null;
  setTaskText: (id: string, itemId: string, text: string) => void;
  setTaskDue: (id: string, itemId: string, due: string | null) => void;
  toggleTask: (id: string, itemId: string) => void;
  removeTaskItem: (id: string, itemId: string) => void;
  openBoard: (boardId: string) => void;
  renameBoard: (boardId: string, title: string) => void;
  // Database (spec §8.4)
  renameDatabase: (dbId: string, title: string) => void;
  addColumn: (dbId: string, type?: ColumnType) => void;
  renameColumn: (dbId: string, colId: string, name: string) => void;
  setColumnType: (dbId: string, colId: string, type: ColumnType) => void;
  /** Setel database tujuan untuk kolom "relation" (spec §8.6). */
  setColumnTarget: (dbId: string, colId: string, targetDatabaseId: string) => void;
  /** Perbarui konfigurasi kolom "rollup" (spec §7.1). */
  setRollup: (dbId: string, colId: string, patch: Partial<Pick<DbColumn, "rollupRelationId" | "rollupOp" | "rollupTargetColumnId">>) => void;
  removeColumn: (dbId: string, colId: string) => void;
  addRow: (dbId: string) => void;
  /** Tambah baris dengan satu sel sudah terisi — dipakai "+ baris" per kolom Kanban. */
  addRowInGroup: (dbId: string, colId: string, value: CellValue) => void;
  setCell: (dbId: string, rowId: string, colId: string, value: CellValue) => void;
  /** Tautkan/lepas satu baris tujuan di sel relasi (toggle). */
  toggleRelation: (dbId: string, rowId: string, colId: string, targetRowId: string) => void;
  removeRow: (dbId: string, rowId: string) => void;
  /** Buka isi kanvas sebuah baris (spec §7.2, irisan tipis). Board bersarangnya
   *  dibuat lazy saat pertama dipanggil, lalu langsung dibuka. Mengembalikan id
   *  board (atau null bila db/baris tak ada). Penutupan overlay database diurus
   *  pemanggil supaya store tetap murni terhadap UI store. */
  openRowAsBoard: (dbId: string, rowId: string) => string | null;
  /** Set posisi kartu baris di tampilan Spatial (spec §7.2). Commit saat drop. */
  moveRowSpatial: (dbId: string, rowId: string, x: number, y: number) => void;
  setDatabaseView: (dbId: string, view: DatabaseView) => void;
  setDatabaseGroupBy: (dbId: string, colId: string) => void;
  setDatabaseDateBy: (dbId: string, colId: string) => void;
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
  /** Loncat ke sebuah elemen: buka papannya, pusatkan kamera, pilih. Dipakai
   *  Agenda untuk menuju tugas yang diklik, di papan mana pun ia berada. */
  focusElement: (id: string) => void;
  /** Tempelkan potongan papan-klip ke sebuah papan dengan id baru untuk semua
   *  elemen & papan (deep clone), lalu pilih kartu hasil tempelan. */
  pasteElements: (payload: ClipboardPayload, targetBoardId: string, offset: { x: number; y: number }) => string[];
  setEditing: (id: string | null) => void;
  bringToFront: (id: string) => void;
}

const rootBoard: Board = { id: ROOT_BOARD_ID, title: "Home", parentBoardId: null };
// Inbox anak dari root supaya breadcrumb-nya "Home / Inbox" (ada jalan pulang),
// tapi tak pernah muncul sebagai kartu — tak ada BOARD_REF yang menunjuknya.
const inboxBoard: Board = { id: INBOX_BOARD_ID, title: "Inbox", parentBoardId: ROOT_BOARD_ID };

/** Board bawaan yang harus SELALU ada, berapa pun isi data tersimpan. Digabung
 *  di setiap titik muat (hydrate/replace/undo) supaya Home & Inbox tak bisa
 *  hilang atau ketimpa data lama. */
const baseBoards = (): Record<string, Board> => ({
  [ROOT_BOARD_ID]: rootBoard,
  [INBOX_BOARD_ID]: inboxBoard,
});

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

/** Pembungkus umum untuk mengubah satu Database, menjaga guard "ada/tidak"
 *  tetap satu tempat (mirip updateTaskList untuk daftar tugas). */
function updateDatabase(
  set: SetState,
  id: string,
  fn: (db: Database) => Database
) {
  set((s) => {
    const db = s.databases[id];
    if (!db) return s;
    return { databases: { ...s.databases, [id]: fn(db) } };
  });
}

/** Konversi/buang nilai sel saat tipe kolom berubah. Mengembalikan `undefined`
 *  berarti sel harus dihapus (data lama tak cocok tipe baru) — supaya tidak ada
 *  nilai hantu yang UI utama sembunyikan tapi search/summary/export masih baca. */
function coerceCell(value: CellValue, type: ColumnType): CellValue | undefined {
  switch (type) {
    case "text":
      if (typeof value === "string") return value;
      if (typeof value === "number") return String(value);
      return undefined;
    case "number":
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)))
        return Number(value);
      return undefined;
    case "checkbox":
      return typeof value === "boolean" ? value : undefined; // jangan menebak dari teks
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    case "relation":
      return Array.isArray(value) ? value : undefined;
    case "rollup":
      return undefined; // kolom hitung — tak menyimpan sel
  }
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
  databases: Record<string, Database>,
  cameras: Record<string, Camera>,
  ids: string[]
): {
  boards: Record<string, Board>;
  elements: Record<string, BoardElement>;
  databases: Record<string, Database>;
  cameras: Record<string, Camera>;
} {
  const nb = { ...boards };
  const ne = { ...elements };
  const nd = { ...databases };
  const nc = { ...cameras };

  // Hapus satu elemen beserta entitas yang cuma "dimiliki" olehnya.
  const purge = (id: string) => {
    const el = ne[id];
    if (!el) return;
    delete ne[id];
    // Kartu database = hapus tabelnya, TAPI cuma kalau tidak ada kartu pintu
    // lain (di board mana pun) yang masih menunjuk ke database yang sama —
    // satu database bisa dipanggil dari banyak board (spec §7.3), jadi hapus
    // satu kartu tidak boleh menghancurkan data yang masih dipakai board lain.
    if (el.type === "DATABASE_REF") {
      const stillReferenced = Object.values(ne).some(
        (e) => e.type === "DATABASE_REF" && e.content.databaseId === el.content.databaseId
      );
      if (!stillReferenced) {
        // Board kanvas bertaut milik tiap baris ikut yatim → buang board +
        // keturunannya + isinya, sama seperti penghapusan kartu BOARD_REF.
        const db = nd[el.content.databaseId];
        for (const r of db?.rows ?? []) {
          if (!r.boardId || !nb[r.boardId]) continue;
          const doomed = collectDescendants(nb, r.boardId);
          for (const bid of doomed) {
            delete nb[bid];
            delete nc[bid];
            for (const e of Object.values(ne)) {
              if (e.boardId === bid) purge(e.id);
            }
          }
        }
        delete nd[el.content.databaseId];
      }
    }
    // Kartu papan = hapus papan + seluruh keturunannya + isinya (rekursif,
    // supaya kartu database di dalamnya ikut membuang tabelnya).
    if (el.type === "BOARD_REF") {
      const doomed = collectDescendants(nb, el.content.boardId);
      for (const bid of doomed) {
        delete nb[bid];
        delete nc[bid];
        for (const e of Object.values(ne)) {
          if (e.boardId === bid) purge(e.id);
        }
      }
    }
  };

  for (const id of ids) purge(id);

  for (const e of Object.values(ne)) {
    if (e.type === "CONNECTOR" && (!ne[e.sourceElementId] || !ne[e.targetElementId])) {
      delete ne[e.id];
    }
  }

  return { boards: nb, elements: ne, databases: nd, cameras: nc };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boards: baseBoards(),
  elements: {},
  databases: {},
  cameras: {},
  currentBoardId: ROOT_BOARD_ID,
  selectedIds: [],
  editingId: null,
  camera: DEFAULT_CAMERA,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      let data = await idbGet<Partial<Persisted>>(IDB_WORKSPACE_KEY);
      // Migrasi sekali dari IndexedDB lama (nama db "pinote") → db baru "swanote",
      // supaya rename produk tidak menghilangkan workspace lokal yang sudah ada.
      if (!data) {
        const legacy = await idbGetFrom<Partial<Persisted>>(LEGACY_IDB_DB, "kv", IDB_WORKSPACE_KEY);
        if (legacy) {
          data = legacy;
          await idbSet(IDB_WORKSPACE_KEY, data);
        }
      }
      // Migrasi sekali dari localStorage (versi sebelum IndexedDB) → IndexedDB.
      if (!data) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          data = JSON.parse(raw) as Partial<Persisted>;
          await idbSet(IDB_WORKSPACE_KEY, data);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      if (data) {
        // baseBoards() terakhir: papan bawaan (root/inbox) selalu pakai definisi
        // kanonik, tak bisa ditimpa data persisted yang korup/basi.
        const boards: Record<string, Board> = { ...(data.boards ?? {}), ...baseBoards() };
        const currentBoardId =
          data.currentBoardId && boards[data.currentBoardId]
            ? data.currentBoardId
            : ROOT_BOARD_ID;
        set({
          boards,
          elements: data.elements ?? {},
          databases: data.databases ?? {},
          cameras: data.cameras ?? {},
          currentBoardId,
          camera: data.cameras?.[currentBoardId] ?? DEFAULT_CAMERA,
          hydrated: true,
        });
        return;
      }
    } catch {
      // data korup / IndexedDB gagal → mulai bersih, jangan crash
    }
    set({ hydrated: true });
  },

  replaceWorkspace: (data) => {
    const boards: Record<string, Board> = { ...data.boards, ...baseBoards() };
    const currentBoardId = boards[data.currentBoardId] ? data.currentBoardId : ROOT_BOARD_ID;
    set({
      boards,
      elements: data.elements ?? {},
      databases: data.databases ?? {},
      cameras: data.cameras ?? {},
      currentBoardId,
      camera: data.cameras?.[currentBoardId] ?? DEFAULT_CAMERA,
      selectedIds: [],
      editingId: null,
    });
  },

  applyHistory: (snap) =>
    set((s) => {
      const boards: Record<string, Board> = { ...snap.boards, ...baseBoards() };
      // Papan yang sedang dibuka mungkin ikut terhapus oleh langkah yang
      // dipulihkan → jatuh ke root supaya kanvas tidak menampilkan papan hantu.
      const currentBoardId = boards[snap.currentBoardId] ? snap.currentBoardId : ROOT_BOARD_ID;
      const sameBoard = currentBoardId === s.currentBoardId;
      return {
        boards,
        elements: snap.elements,
        databases: snap.databases,
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

  captureToInbox: () => {
    const id = crypto.randomUUID();
    set((s) => {
      // Tumpuk vertikal berdasarkan jumlah kartu yang sudah ada di Inbox —
      // penempatan deterministik, tak perlu pilih lokasi.
      const count = Object.values(s.elements).filter(
        (e) => e.boardId === INBOX_BOARD_ID && e.type !== "CONNECTOR"
      ).length;
      const x = 0;
      const y = count * 132;

      // Pusatkan kamera Inbox ke kartu baru supaya langsung terlihat & bisa
      // diketik. Simpan dulu kamera papan yang sedang dibuka.
      const W = typeof window !== "undefined" ? window.innerWidth : 1200;
      const H = typeof window !== "undefined" ? window.innerHeight : 800;
      const camera = { x: W / 2 - (x + NOTE_WIDTH / 2), y: H / 2 - (y + 40), zoom: 1 };
      const cameras =
        s.currentBoardId === INBOX_BOARD_ID
          ? { ...s.cameras, [INBOX_BOARD_ID]: camera }
          : { ...s.cameras, [s.currentBoardId]: s.camera, [INBOX_BOARD_ID]: camera };

      return {
        currentBoardId: INBOX_BOARD_ID,
        cameras,
        camera,
        elements: {
          ...s.elements,
          [id]: {
            id,
            boardId: INBOX_BOARD_ID,
            type: "NOTE",
            x,
            y,
            width: NOTE_WIDTH,
            zIndex: count + 1,
            content: { html: "" },
            updatedAt: Date.now(),
          },
        },
        selectedIds: [id],
        editingId: id,
      };
    });
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

  addBoardFromTemplate: (template, worldX, worldY) => {
    const elementId = crypto.randomUUID();
    const newBoardId = crypto.randomUUID();
    const now = Date.now();
    set((s) => {
      const boards = {
        ...s.boards,
        [newBoardId]: { id: newBoardId, title: template.title, parentBoardId: s.currentBoardId },
      };
      const elements = {
        ...s.elements,
        [elementId]: {
          id: elementId,
          boardId: s.currentBoardId,
          type: "BOARD_REF" as const,
          x: worldX - BOARD_CARD_WIDTH / 2,
          y: worldY - 30,
          width: BOARD_CARD_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { boardId: newBoardId },
          updatedAt: now,
        },
      };
      // Isi papan baru dengan kartu template.
      let z = 1;
      for (const tc of template.cards) {
        const cid = crypto.randomUUID();
        if (tc.type === "NOTE") {
          elements[cid] = {
            id: cid,
            boardId: newBoardId,
            type: "NOTE",
            x: tc.x,
            y: tc.y,
            width: tc.width ?? NOTE_WIDTH,
            zIndex: z++,
            content: { html: tc.html },
            updatedAt: now,
          };
        } else {
          elements[cid] = {
            id: cid,
            boardId: newBoardId,
            type: "TASK_LIST",
            x: tc.x,
            y: tc.y,
            width: tc.width ?? TASK_LIST_WIDTH,
            zIndex: z++,
            content: {
              title: tc.title,
              items: tc.items.map((text) => ({ id: crypto.randomUUID(), text, done: false })),
            },
            updatedAt: now,
          };
        }
      }
      // Langsung buka papan baru supaya isinya kelihatan; stash kamera lama.
      const cameras = { ...s.cameras, [s.currentBoardId]: s.camera };
      return {
        boards,
        elements,
        cameras,
        currentBoardId: newBoardId,
        camera: DEFAULT_CAMERA,
        selectedIds: [],
        editingId: null,
      };
    });
    return newBoardId;
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

  setTaskDue: (id, itemId, due) =>
    updateTaskList(set, id, (c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, due } : i)),
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

  addDatabase: (worldX, worldY) => {
    const elementId = crypto.randomUUID();
    const databaseId = crypto.randomUUID();
    const col = (name: string, type: ColumnType): DbColumn => ({ id: crypto.randomUUID(), name, type });
    const columns: DbColumn[] = [col("Nama", "text"), col("Catatan", "text"), col("Selesai", "checkbox")];
    const rows: DbRow[] = [
      { id: crypto.randomUUID(), cells: {} },
      { id: crypto.randomUUID(), cells: {} },
    ];
    set((s) => ({
      databases: {
        ...s.databases,
        [databaseId]: { id: databaseId, title: "Database baru", columns, rows },
      },
      elements: {
        ...s.elements,
        [elementId]: {
          id: elementId,
          boardId: s.currentBoardId,
          type: "DATABASE_REF",
          x: worldX - DATABASE_CARD_WIDTH / 2,
          y: worldY - 30,
          width: DATABASE_CARD_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { databaseId },
          updatedAt: Date.now(),
        },
      },
      selectedIds: [elementId],
    }));
    return elementId;
  },

  attachDatabase: (databaseId, worldX, worldY) => {
    if (!get().databases[databaseId]) return null;
    const elementId = crypto.randomUUID();
    set((s) => ({
      elements: {
        ...s.elements,
        [elementId]: {
          id: elementId,
          boardId: s.currentBoardId,
          type: "DATABASE_REF",
          x: worldX - DATABASE_CARD_WIDTH / 2,
          y: worldY - 30,
          width: DATABASE_CARD_WIDTH,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: { databaseId },
          updatedAt: Date.now(),
        },
      },
      selectedIds: [elementId],
    }));
    return elementId;
  },

  addImage: (worldX, worldY, img) => {
    const id = crypto.randomUUID();
    // Lebar kartu = lebar asli dijepit ke rentang wajar; tinggi ikut rasio saat
    // render. Pusatkan kartu di titik jatuh/tempel.
    const width = Math.min(IMAGE_MAX_WIDTH, Math.max(IMAGE_MIN_WIDTH, img.naturalWidth));
    const height = (width * img.naturalHeight) / img.naturalWidth;
    set((s) => ({
      elements: {
        ...s.elements,
        [id]: {
          id,
          boardId: s.currentBoardId,
          type: "IMAGE",
          x: worldX - width / 2,
          y: worldY - height / 2,
          width,
          zIndex: nextZIndex(s.elements, s.currentBoardId),
          content: img,
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

  // --- Database (spec §8.4) --------------------------------------------------
  renameDatabase: (dbId, title) =>
    updateDatabase(set, dbId, (db) => (db.title === title ? db : { ...db, title })),

  addColumn: (dbId, type = "text") =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: [...db.columns, { id: crypto.randomUUID(), name: `Kolom ${db.columns.length + 1}`, type }],
    })),

  renameColumn: (dbId, colId, name) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: db.columns.map((c) => (c.id === colId ? { ...c, name } : c)),
    })),

  setColumnType: (dbId, colId, type) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: db.columns.map((c) =>
        c.id === colId
          ? // Pindah dari/ke relation: buang targetDatabaseId yang tak relevan.
            { ...c, type, ...(type === "relation" ? {} : { targetDatabaseId: undefined }) }
          : c
      ),
      // Normalisasi sel kolom ini ke tipe baru — konversi bila bisa, buang bila
      // tak cocok, supaya tak ada data lama tersembunyi yang bocor ke search/export.
      rows: db.rows.map((r) => {
        if (!(colId in r.cells)) return r;
        const next = coerceCell(r.cells[colId], type);
        const cells = { ...r.cells };
        if (next === undefined) delete cells[colId];
        else cells[colId] = next;
        return { ...r, cells };
      }),
    })),

  setColumnTarget: (dbId, colId, targetDatabaseId) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: db.columns.map((c) => (c.id === colId ? { ...c, targetDatabaseId } : c)),
    })),

  setRollup: (dbId, colId, patch) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: db.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)),
    })),

  removeColumn: (dbId, colId) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      columns: db.columns.filter((c) => c.id !== colId),
      // Buang selnya dari tiap baris supaya tak jadi data menggantung.
      rows: db.rows.map((r) => {
        if (!(colId in r.cells)) return r;
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    })),

  addRow: (dbId) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      rows: [...db.rows, { id: crypto.randomUUID(), cells: {} }],
    })),

  addRowInGroup: (dbId, colId, value) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      rows: [...db.rows, { id: crypto.randomUUID(), cells: { [colId]: value } }],
    })),

  setCell: (dbId, rowId, colId, value) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      rows: db.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      ),
    })),

  toggleRelation: (dbId, rowId, colId, targetRowId) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      rows: db.rows.map((r) => {
        if (r.id !== rowId) return r;
        const cur = Array.isArray(r.cells[colId]) ? (r.cells[colId] as string[]) : [];
        const next = cur.includes(targetRowId)
          ? cur.filter((x) => x !== targetRowId)
          : [...cur, targetRowId];
        return { ...r, cells: { ...r.cells, [colId]: next } };
      }),
    })),

  removeRow: (dbId, rowId) =>
    set((s) => {
      const db = s.databases[dbId];
      if (!db) return s;
      const gone = db.rows.find((r) => r.id === rowId);
      const databases = { ...s.databases };
      // Hapus barisnya dari database asalnya.
      databases[dbId] = { ...db, rows: db.rows.filter((r) => r.id !== rowId) };
      // Bersihkan tautan masuk: relasi mana pun yang menunjuk baris ini kini
      // menggantung — buang idnya supaya count rollup & chip tetap konsisten.
      for (const [id, d] of Object.entries(databases)) {
        const relCols = d.columns.filter(
          (c) => c.type === "relation" && c.targetDatabaseId === dbId
        );
        if (relCols.length === 0) continue;
        let changed = false;
        const rows = d.rows.map((r) => {
          let cells = r.cells;
          for (const col of relCols) {
            const v = cells[col.id];
            if (Array.isArray(v) && v.includes(rowId)) {
              cells = { ...cells, [col.id]: (v as string[]).filter((x) => x !== rowId) };
              changed = true;
            }
          }
          return cells === r.cells ? r : { ...r, cells };
        });
        if (changed) databases[id] = { ...d, rows };
      }
      // Baris punya kanvas bertaut → buang board + keturunannya + isinya, supaya
      // tak jadi data menggantung (konsisten dg penghapusan kartu BOARD_REF).
      if (gone?.boardId && s.boards[gone.boardId]) {
        const nb = { ...s.boards };
        const nc = { ...s.cameras };
        const ne = { ...s.elements };
        const doomed = collectDescendants(nb, gone.boardId);
        for (const bid of doomed) {
          delete nb[bid];
          delete nc[bid];
          for (const e of Object.values(ne)) {
            if (e.boardId === bid) delete ne[e.id];
          }
        }
        return { databases, boards: nb, cameras: nc, elements: ne };
      }
      return { databases };
    }),

  openRowAsBoard: (dbId, rowId) => {
    const s0 = get();
    const db = s0.databases[dbId];
    const row = db?.rows.find((r) => r.id === rowId);
    if (!db || !row) return null;
    // Sudah punya kanvas & board-nya masih hidup → cukup buka.
    if (row.boardId && s0.boards[row.boardId]) {
      get().openBoard(row.boardId);
      return row.boardId;
    }
    const newBoardId = crypto.randomUUID();
    // Judul board = nilai kolom teks pertama yang terisi, kalau kosong "Baris".
    const textCol = db.columns.find((c) => c.type === "text");
    const tv = textCol ? row.cells[textCol.id] : null;
    const title = typeof tv === "string" && tv.trim() ? tv.trim() : "Baris";
    set((s) => {
      const board: Board = { id: newBoardId, title, parentBoardId: s.currentBoardId };
      const rows = (s.databases[dbId]?.rows ?? []).map((r) =>
        r.id === rowId ? { ...r, boardId: newBoardId } : r
      );
      const cameras = { ...s.cameras, [s.currentBoardId]: s.camera };
      return {
        boards: { ...s.boards, [newBoardId]: board },
        databases: { ...s.databases, [dbId]: { ...s.databases[dbId], rows } },
        cameras,
        currentBoardId: newBoardId,
        camera: DEFAULT_CAMERA,
        selectedIds: [],
        editingId: null,
      };
    });
    return newBoardId;
  },

  moveRowSpatial: (dbId, rowId, x, y) =>
    updateDatabase(set, dbId, (db) => ({
      ...db,
      rows: db.rows.map((r) => (r.id === rowId ? { ...r, sx: x, sy: y } : r)),
    })),

  setDatabaseView: (dbId, view) => updateDatabase(set, dbId, (db) => ({ ...db, view })),

  setDatabaseGroupBy: (dbId, colId) =>
    updateDatabase(set, dbId, (db) => ({ ...db, groupBy: colId })),

  setDatabaseDateBy: (dbId, colId) =>
    updateDatabase(set, dbId, (db) => ({ ...db, dateBy: colId })),

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
      const { boards, elements, databases, cameras } = removeElements(
        s.boards, s.elements, s.databases, s.cameras, [id]
      );
      return {
        elements,
        boards,
        databases,
        cameras,
        selectedIds: s.selectedIds.filter((x) => elements[x]),
        editingId: s.editingId && elements[s.editingId] ? s.editingId : null,
      };
    }),

  removeMany: (ids) =>
    set((s) => {
      if (!ids.some((id) => s.elements[id])) return s;
      const { boards, elements, databases, cameras } = removeElements(
        s.boards, s.elements, s.databases, s.cameras, ids
      );
      return {
        elements,
        boards,
        databases,
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

  focusElement: (id) =>
    set((s) => {
      const el = s.elements[id];
      if (!el || el.type === "CONNECTOR") return s;
      const zoom = 1;
      const W = typeof window !== "undefined" ? window.innerWidth : 1200;
      const H = typeof window !== "undefined" ? window.innerHeight : 800;
      // Pusatkan tepi-atas kartu di viewport (tinggi kartu tak ada di data).
      const wx = el.x + el.width / 2;
      const wy = el.y + 60;
      const camera = { x: W / 2 - wx * zoom, y: H / 2 - wy * zoom, zoom };
      const switching = el.boardId !== s.currentBoardId;
      const cameras = switching
        ? { ...s.cameras, [s.currentBoardId]: s.camera, [el.boardId]: camera }
        : { ...s.cameras, [el.boardId]: camera };
      return {
        currentBoardId: el.boardId,
        cameras,
        camera,
        selectedIds: [id],
        editingId: null,
      };
    }),

  pasteElements: (payload, targetBoardId, offset) => {
    let newTopIds: string[] = [];
    set((s) => {
      // Id baru untuk tiap papan & elemen yang disalin.
      const boardIdMap = new Map<string, string>();
      for (const bid of Object.keys(payload.boards)) boardIdMap.set(bid, crypto.randomUUID());
      const elIdMap = new Map<string, string>();
      for (const eid of Object.keys(payload.elements)) elIdMap.set(eid, crypto.randomUUID());
      const dbIdMap = new Map<string, string>();
      for (const did of Object.keys(payload.databases)) dbIdMap.set(did, crypto.randomUUID());

      // Kloning tabel dengan id baru (baris tetap id lama — sudah terlingkup
      // per-database, jadi tak bentrok).
      const databases = { ...s.databases };
      for (const [oldId, db] of Object.entries(payload.databases)) {
        const nid = dbIdMap.get(oldId)!;
        const cloned = structuredClone({ ...db, id: nid });
        // Relasi ke database yang ikut tersalin harus menunjuk salinannya, bukan
        // aslinya. (Id kolom & baris dipertahankan saat kloning, jadi sel relasi
        // dan rollup tetap valid tanpa dipetakan ulang.)
        cloned.columns = cloned.columns.map((c) =>
          c.type === "relation" && c.targetDatabaseId && dbIdMap.has(c.targetDatabaseId)
            ? { ...c, targetDatabaseId: dbIdMap.get(c.targetDatabaseId)! }
            : c
        );
        // Lepas tautan kanvas baris: board bersarangnya tak ikut dikloning di
        // jalur salin ini, jadi mempertahankan boardId akan membuat salinan &
        // asli berbagi board yang sama (hapus di satu sisi menghapus di sisi lain).
        // cloned = hasil structuredClone yang segar, jadi aman dimutasi.
        for (const r of cloned.rows) delete r.boardId;
        databases[nid] = cloned;
      }

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
        if (cloned.type === "DATABASE_REF" && el.type === "DATABASE_REF") {
          cloned.content = { databaseId: dbIdMap.get(el.content.databaseId) ?? el.content.databaseId };
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
      return { boards, elements, databases, selectedIds: tops };
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

// Autosave: debounce ke IndexedDB (sumber kebenaran lokal). Dipindah dari
// localStorage karena data URL gambar menembus batas ~5MB-nya; IndexedDB juga
// menyimpan objek langsung tanpa biaya JSON.stringify.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastDocRefs: Pick<CanvasState, "boards" | "elements" | "databases" | "currentBoardId"> | null =
  null;
useCanvasStore.subscribe((state) => {
  if (!state.hydrated) return;
  // Perubahan dokumen vs cuma kamera (pan/zoom). Kamera ikut disimpan supaya
  // viewport pulih, tapi menulis ulang seluruh blob (termasuk data URL gambar)
  // tiap geser itu boros — beri debounce lebih panjang untuk perubahan kamera saja.
  const docChanged =
    !lastDocRefs ||
    lastDocRefs.boards !== state.boards ||
    lastDocRefs.elements !== state.elements ||
    lastDocRefs.databases !== state.databases ||
    lastDocRefs.currentBoardId !== state.currentBoardId;
  lastDocRefs = {
    boards: state.boards,
    elements: state.elements,
    databases: state.databases,
    currentBoardId: state.currentBoardId,
  };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Simpan gagal (mis. kuota) tidak boleh mengganggu interaksi.
    void idbSet(IDB_WORKSPACE_KEY, snapshot(state)).catch(() => {});
  }, docChanged ? 400 : 1500);
});
