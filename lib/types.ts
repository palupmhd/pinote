// Data model per TECHNICAL_SPEC.md §2
export type ElementType = "NOTE" | "BOARD_REF";

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

export type BoardElement = NoteElement | BoardRefElement;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const ROOT_BOARD_ID = "root";
export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };
