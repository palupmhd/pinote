// Data model per TECHNICAL_SPEC.md §2 — v0 baru NOTE, tipe lain menyusul
export type ElementType = "NOTE";

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  zIndex: number;
  content: { html: string };
  updatedAt: number; // epoch ms — dipakai Last-Write-Wins saat sync cloud
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
