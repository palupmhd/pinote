// Data model per TECHNICAL_SPEC.md §2
export type ElementType = "NOTE" | "BOARD_REF" | "TASK_LIST" | "CONNECTOR";

export interface Board {
  id: string;
  title: string;
  parentBoardId: string | null; // null = papan root
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

/** Kartu di kanvas yang membuka Board lain. Board-nya entitas terpisah, kartu
 *  ini hanya "pintu" — pola yang sama nanti dipakai DatabaseView (spec §8.4). */
export interface BoardRefElement extends BaseElement {
  type: "BOARD_REF";
  content: { boardId: string };
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

/** Daftar tugas. Teks item sengaja plain string, bukan rich text — item tugas
 *  itu satu baris pendek, tidak perlu ProseMirror per baris.
 *  Catatan: field tanggal per item belum ada; menyusul bareng Calendar view
 *  (spec §8) supaya tidak ada field yang tidak punya UI. */
export interface TaskListElement extends BaseElement {
  type: "TASK_LIST";
  content: { title: string; items: TaskItem[] };
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
export type CardElement = NoteElement | BoardRefElement | TaskListElement;

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

export const ROOT_BOARD_ID = "root";
export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };
