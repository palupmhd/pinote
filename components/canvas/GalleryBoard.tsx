"use client";

import { useCanvasStore } from "@/lib/store";
import type { CellValue, Database, DbColumn } from "@/lib/types";

/** Ringkasan sebuah sel untuk kartu galeri (baca saja). null = jangan tampilkan. */
function cellSummary(col: DbColumn, v: CellValue): string | null {
  if (col.type === "checkbox") return v === true ? `✓ ${col.name}` : null;
  if (col.type === "relation") {
    const n = Array.isArray(v) ? v.length : 0;
    return n > 0 ? `${col.name}: ${n} tertaut` : null;
  }
  if (v == null || v === "") return null;
  return `${col.name}: ${v}`;
}

export function GalleryBoard({ db }: { db: Database }) {
  const setCell = useCanvasStore((s) => s.setCell);
  const addRow = useCanvasStore((s) => s.addRow);
  const removeRow = useCanvasStore((s) => s.removeRow);

  const titleCol = db.columns.find((c) => c.type === "text");
  const otherCols = db.columns.filter((c) => c.id !== titleCol?.id);

  return (
    <div className="h-full overflow-auto p-4">
      {db.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">Belum ada baris.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {db.rows.map((row) => (
            <div
              key={row.id}
              className="group relative flex flex-col gap-1.5 rounded-md bg-white p-3 shadow-sm ring-1 ring-neutral-200"
            >
              {titleCol ? (
                <input
                  value={typeof row.cells[titleCol.id] === "string" ? (row.cells[titleCol.id] as string) : ""}
                  onChange={(e) => setCell(db.id, row.id, titleCol.id, e.target.value || null)}
                  placeholder="Tanpa judul"
                  className="w-full bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-300"
                />
              ) : (
                <span className="text-sm font-medium text-neutral-800">Baris</span>
              )}

              <div className="flex flex-col gap-1">
                {otherCols.map((c) => {
                  const s = cellSummary(c, row.cells[c.id] ?? null);
                  return s ? (
                    <span key={c.id} className="truncate text-xs text-neutral-500">
                      {s}
                    </span>
                  ) : null;
                })}
              </div>

              <button
                onClick={() => removeRow(db.id, row.id)}
                title="Hapus baris"
                className="absolute right-1.5 top-1.5 text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => addRow(db.id)}
        className="mt-3 rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        + Tambah baris
      </button>
    </div>
  );
}
