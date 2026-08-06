import type { CellValue, DbColumn } from "./types";

/** Ringkasan satu sel (baca saja) untuk kartu ringkas — dipakai kartu Galeri
 *  DAN kartu Spasial, yang sebelumnya punya salinan fungsi ini masing-masing
 *  (identik baris per baris, jadi tiap perubahan aturan tampil harus diingat
 *  untuk diterapkan dua kali). null = jangan tampilkan barisnya sama sekali. */
export function cellSummary(col: DbColumn, v: CellValue): string | null {
  if (col.type === "checkbox") return v === true ? `✓ ${col.name}` : null;
  if (col.type === "relation") {
    const n = Array.isArray(v) ? v.length : 0;
    return n > 0 ? `${col.name}: ${n} tertaut` : null;
  }
  if (v == null || v === "") return null;
  return `${col.name}: ${v}`;
}
