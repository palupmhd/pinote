"use client";

import { useRef, useState } from "react";
import { connectorPath } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import type { Box, CellValue, Database, DbColumn } from "@/lib/types";

/** Tampilan Spatial (spec §7.2 dual-mode penuh): tiap baris jadi kartu bebas
 *  yang bisa digeser, tetap membawa properti terstrukturnya. Kolom relasi yang
 *  menunjuk database yang SAMA digambar sebagai panah antar-kartu (§7.4) — jadi
 *  mind-map antar-baris; relasi ke database lain tetap tampil sebagai chip. */

const CARD_W = 190;
const CARD_H = 120; // estimasi untuk kotak panah (tinggi asli ikut isi)
const GAP = 28;
const PAD = 24;

/** Posisi grid deterministik untuk baris yang belum pernah digeser. */
function autoPos(index: number): { x: number; y: number } {
  const cols = 4;
  return { x: PAD + (index % cols) * (CARD_W + GAP), y: PAD + Math.floor(index / cols) * (CARD_H + GAP) };
}

/** Ringkasan sel (baca saja) untuk kartu. null = jangan tampilkan. */
function cellSummary(col: DbColumn, v: CellValue): string | null {
  if (col.type === "checkbox") return v === true ? `✓ ${col.name}` : null;
  if (col.type === "relation") {
    const n = Array.isArray(v) ? v.length : 0;
    return n > 0 ? `${col.name}: ${n} tertaut` : null;
  }
  if (v == null || v === "") return null;
  return `${col.name}: ${v}`;
}

export function SpatialBoard({
  db,
  onOpenRowCanvas,
}: {
  db: Database;
  onOpenRowCanvas: (rowId: string) => void;
}) {
  const setCell = useCanvasStore((s) => s.setCell);
  const addRow = useCanvasStore((s) => s.addRow);
  const removeRow = useCanvasStore((s) => s.removeRow);
  const moveRowSpatial = useCanvasStore((s) => s.moveRowSpatial);

  const titleCol = db.columns.find((c) => c.type === "text");
  // Kolom relasi self-referencing (target = database ini) → digambar sebagai panah.
  const selfRelCols = db.columns.filter((c) => c.type === "relation" && c.targetDatabaseId === db.id);
  const selfRelIds = new Set(selfRelCols.map((c) => c.id));
  // Kolom lain yang diringkas sebagai chip (bukan judul, bukan self-relation).
  const summaryCols = db.columns.filter((c) => c.id !== titleCol?.id && !selfRelIds.has(c.id));

  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const startRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Posisi efektif sebuah baris: live saat digeser, lalu sx/sy, lalu auto-layout.
  const posOf = (rowId: string, index: number): { x: number; y: number } => {
    if (drag?.id === rowId) return { x: drag.x, y: drag.y };
    const r = db.rows[index];
    if (r && typeof r.sx === "number" && typeof r.sy === "number") return { x: r.sx, y: r.sy };
    return autoPos(index);
  };

  const idIndex = new Map(db.rows.map((r, i) => [r.id, i] as const));
  const boxOf = (rowId: string): Box | null => {
    const i = idIndex.get(rowId);
    if (i == null) return null;
    const p = posOf(rowId, i);
    return { x: p.x, y: p.y, w: CARD_W, h: CARD_H };
  };

  // Panah untuk tiap tautan self-relation.
  const arrows: { key: string; d: string }[] = [];
  for (const col of selfRelCols) {
    for (const r of db.rows) {
      const v = r.cells[col.id];
      if (!Array.isArray(v)) continue;
      for (const tid of v) {
        if (tid === r.id || !idIndex.has(tid)) continue;
        const a = boxOf(r.id);
        const b = boxOf(tid);
        if (a && b) arrows.push({ key: `${col.id}:${r.id}->${tid}`, d: connectorPath(a, b) });
      }
    }
  }

  // Ukuran permukaan = kotak-batas semua kartu + padding, supaya bisa di-scroll.
  let maxX = 600;
  let maxY = 400;
  db.rows.forEach((r, i) => {
    const p = posOf(r.id, i);
    maxX = Math.max(maxX, p.x + CARD_W);
    maxY = Math.max(maxY, p.y + CARD_H);
  });

  const onPointerDown = (e: React.PointerEvent, rowId: string, index: number) => {
    if ((e.target as HTMLElement).closest("input, select, button, a")) return; // jangan drag dari kontrol
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = posOf(rowId, index);
    startRef.current = { px: e.clientX, py: e.clientY, ox: p.x, oy: p.y };
    setDrag({ id: rowId, x: p.x, y: p.y });
  };
  const onPointerMove = (e: React.PointerEvent, rowId: string) => {
    if (drag?.id !== rowId || !startRef.current) return;
    const s = startRef.current;
    setDrag({ id: rowId, x: Math.max(0, s.ox + (e.clientX - s.px)), y: Math.max(0, s.oy + (e.clientY - s.py)) });
  };
  const onPointerUp = (rowId: string) => {
    if (drag?.id === rowId) moveRowSpatial(db.id, rowId, drag.x, drag.y);
    setDrag(null);
    startRef.current = null;
  };

  return (
    <div className="relative h-full overflow-auto bg-neutral-50/50">
      <div className="relative" style={{ width: maxX + PAD, height: maxY + PAD }}>
        {/* Panah self-relation (ungu putus-putus, konsisten dg §8.6 di kanvas). */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
          <defs>
            <marker id="spatial-rel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
            </marker>
          </defs>
          {arrows.map((a) => (
            <path
              key={a.key}
              d={a.d}
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              markerEnd="url(#spatial-rel-arrow)"
              style={{ strokeLinecap: "round" }}
            />
          ))}
        </svg>

        {db.rows.map((row, index) => {
          const p = posOf(row.id, index);
          return (
            <div
              key={row.id}
              onPointerDown={(e) => onPointerDown(e, row.id, index)}
              onPointerMove={(e) => onPointerMove(e, row.id)}
              onPointerUp={() => onPointerUp(row.id)}
              onPointerCancel={() => { setDrag(null); startRef.current = null; }}
              style={{ left: p.x, top: p.y, width: CARD_W }}
              className={[
                "group absolute touch-none rounded-md bg-white p-2 shadow-sm ring-1 ring-neutral-200",
                drag?.id === row.id ? "cursor-grabbing opacity-70 shadow-md" : "cursor-grab",
              ].join(" ")}
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

              <div className="mt-1 flex flex-col gap-0.5">
                {summaryCols.map((c) => {
                  const s = cellSummary(c, row.cells[c.id] ?? null);
                  return s ? (
                    <span key={c.id} className="truncate text-[11px] text-neutral-500">{s}</span>
                  ) : null;
                })}
              </div>

              <div className="mt-1.5 flex items-center justify-end gap-1">
                <button
                  onClick={() => onOpenRowCanvas(row.id)}
                  title={row.boardId ? "Buka kanvas baris" : "Buka baris sebagai kanvas"}
                  className={
                    row.boardId
                      ? "px-1 text-indigo-500 hover:text-indigo-700"
                      : "px-1 text-neutral-300 opacity-0 hover:text-neutral-700 group-hover:opacity-100"
                  }
                >
                  ⤢
                </button>
                <button
                  onClick={() => removeRow(db.id, row.id)}
                  title="Hapus baris"
                  className="px-1 text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => addRow(db.id)}
        className="absolute left-3 top-3 z-10 rounded bg-white px-2 py-1 text-sm text-neutral-500 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-800"
      >
        + Tambah baris
      </button>
    </div>
  );
}
