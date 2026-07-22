// Data model per TECHNICAL_SPEC.md §2
export type ElementType =
  | "NOTE"
  | "BOARD_REF"
  | "TASK_LIST"
  | "LINK"
  | "IMAGE"
  | "DATABASE_REF"
  | "CONNECTOR";

export interface Board {
  id: string;
  title: string;
  parentBoardId: string | null; // null = papan root
}

// --- Database (spec §8.4) ----------------------------------------------------
// Tabel bertipe: entitas terpisah (seperti Board), dibuka lewat kartu "pintu"
// DATABASE_REF. Baris disimpan di dalam entitas ini, bukan sebagai elemen
// kanvas — relasi antar-baris sebagai panah menyusul di §8.6.
export type ColumnType = "text" | "number" | "checkbox" | "date" | "relation" | "rollup" | "formula";

/** Agregasi kolom rollup (spec §7.1). count = jumlah baris tertaut; sisanya
 *  atas kolom angka di database tujuan relasi. */
export type RollupOp = "count" | "sum" | "avg" | "min" | "max";

/** Preset fungsi kolom formula (spec §7.1: preset, bukan DSL). Tanggal butuh 1
 *  kolom input (colA); angka & teks butuh 2 (colA, colB). Nilai dihitung, tak
 *  disimpan. */
export type FormulaPreset =
  | "days_until"
  | "date_status"
  | "sum"
  | "diff"
  | "product"
  | "percent"
  | "concat";

export interface DbColumn {
  id: string;
  name: string;
  type: ColumnType;
  /** Hanya untuk kolom "relation": id database yang barisnya bisa ditautkan.
   *  Relasi antar-baris (spec §8.6) — digambar sebagai panah antar kartu
   *  database, memakai ulang mekanisme konektor. */
  targetDatabaseId?: string;
  /** Konfigurasi kolom "rollup": lewat relasi mana, fungsi apa, kolom angka apa
   *  (untuk sum/avg/min/max) di database tujuan. Nilainya dihitung, tak disimpan. */
  rollupRelationId?: string;
  rollupOp?: RollupOp;
  rollupTargetColumnId?: string;
  /** Konfigurasi kolom "formula" (spec §7.1): preset + kolom input. Tanggal pakai
   *  colA saja; angka/teks pakai colA & colB. Nilainya dihitung, tak disimpan. */
  formulaPreset?: FormulaPreset;
  formulaColA?: string;
  formulaColB?: string;
}

/** Sel biasa = string/number/boolean/null. Sel kolom "relation" = daftar id
 *  baris tujuan (string[]). */
export type CellValue = string | number | boolean | string[] | null;

export interface DbRow {
  id: string;
  /** nilai per kolom, dikunci id kolom; kolom tanpa entri = sel kosong. */
  cells: Record<string, CellValue>;
  /** Board bersarang opsional untuk "isi kanvas" baris ini (spec §7.2 dual-mode,
   *  irisan tipis). Dibuat lazy saat pertama kali baris dibuka sebagai kanvas;
   *  baris tanpa field ini = belum punya kanvas (mayoritas baris). */
  boardId?: string;
  /** Posisi kartu di tampilan Spatial (spec §7.2 dual-mode penuh). Baris tanpa
   *  koordinat di-auto-layout grid; koordinat tersimpan begitu baris digeser. */
  sx?: number;
  sy?: number;
}

export type DatabaseView = "table" | "kanban" | "calendar" | "gallery" | "spatial";

export interface Database {
  id: string;
  title: string;
  columns: DbColumn[];
  rows: DbRow[];
  /** Mode tampilan (spec §7.3). Default "table". */
  view?: DatabaseView;
  /** Kolom pengelompok untuk Kanban (id kolom text/checkbox). */
  groupBy?: string;
  /** Kolom tanggal untuk Kalender (id kolom date). */
  dateBy?: string;
}

interface BaseElement {
  id: string;
  boardId: string; // papan tempat elemen ini diletakkan
  x: number;
  y: number;
  width: number;
  zIndex: number;
  updatedAt: number; // epoch ms — dipakai Last-Write-Wins saat sync cloud
}

export interface NoteElement extends BaseElement {
  type: "NOTE";
  content: { html: string };
}

/** Gambar tertanam. src berupa data URL (sudah dikecilkan saat impor) supaya
 *  kartu tetap tampil offline dan ikut ke cloud tanpa hosting terpisah. Rasio
 *  disimpan agar tinggi kartu bisa diturunkan dari lebarnya. */
export interface ImageElement extends BaseElement {
  type: "IMAGE";
  content: { src: string; naturalWidth: number; naturalHeight: number };
}

/** Kartu di kanvas yang membuka Board lain. Board-nya entitas terpisah, kartu
 *  ini hanya "pintu" — pola yang sama dipakai DATABASE_REF di bawah (spec §8.4). */
export interface BoardRefElement extends BaseElement {
  type: "BOARD_REF";
  content: { boardId: string };
}

/** Kartu "pintu" ke sebuah Database. Sama seperti BOARD_REF: entitasnya
 *  (tabelnya) terpisah, kartu ini hanya penunjuk. Membukanya menampilkan
 *  editor tabel, bukan kanvas bersarang. */
export interface DatabaseRefElement extends BaseElement {
  type: "DATABASE_REF";
  content: { databaseId: string };
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  /** Tenggat, format lokal "YYYY-MM-DD" (bukan epoch — hari, bukan momen).
   *  Opsional; item tanpa tenggat tidak muncul di Calendar/Agenda. */
  due?: string | null;
}

/** Daftar tugas. Teks item sengaja plain string, bukan rich text — item tugas
 *  itu satu baris pendek, tidak perlu ProseMirror per baris. */
export interface TaskListElement extends BaseElement {
  type: "TASK_LIST";
  content: { title: string; items: TaskItem[] };
}

/** Tautan dengan pratinjau. Metadata di-cache di dalam elemen supaya kartu
 *  tetap terbaca saat offline dan tidak menembak ulang situsnya tiap render. */
export interface LinkElement extends BaseElement {
  type: "LINK";
  content: {
    url: string;
    title?: string;
    description?: string | null;
    image?: string | null;
    siteName?: string | null;
    /** pending = pratinjau sedang diambil; failed = simpan URL apa adanya */
    state: "empty" | "pending" | "ready" | "failed";
  };
}

/** Garis penghubung antar elemen.
 *
 *  Sengaja GENERIK: source/target cuma ID elemen, tanpa asumsi tipe apa pun.
 *  Ini syarat supaya nanti relasi antar row database bisa digambar sebagai
 *  panah (spec §8.6) dengan memakai ulang mekanisme ini — bukan bikin yang
 *  baru. Jangan pernah di-hardcode ke tipe elemen tertentu.
 *
 *  Tidak punya x/y/width: posisinya diturunkan dari kedua ujungnya. */
export interface ConnectorElement {
  id: string;
  boardId: string;
  type: "CONNECTOR";
  sourceElementId: string;
  targetElementId: string;
  zIndex: number;
  updatedAt: number;
}

/** Elemen yang punya posisi & bisa digeser di kanvas. */
export type CardElement =
  | NoteElement
  | BoardRefElement
  | TaskListElement
  | LinkElement
  | ImageElement
  | DatabaseRefElement;

export type BoardElement = CardElement | ConnectorElement;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Isi papan-klip untuk copy/paste/duplicate. Menyimpan potongan graf yang
 *  mandiri: kartu yang disalin, konektor di antara mereka, dan — untuk kartu
 *  papan — seluruh subpohon papannya (papan + isinya, rekursif) supaya menempel
 *  kembali menjadi salinan penuh, bukan menunjuk papan yang sama. */
export interface ClipboardPayload {
  elements: Record<string, BoardElement>;
  boards: Record<string, Board>;
  databases: Record<string, Database>;
}

export const ROOT_BOARD_ID = "root";
/** Board tangkapan-cepat (spec §9.1): selalu ada, tak bisa dihapus, dijangkau
 *  lewat tombol/pintasan — bukan lewat kartu di kanvas. */
export const INBOX_BOARD_ID = "inbox";
export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };
