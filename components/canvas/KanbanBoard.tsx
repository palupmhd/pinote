"use client";

import { useMemo, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import type { CellValue, Database, DbColumn } from "@/lib/types";

/** Kolom yang layak jadi pengelompok Kanban: nilai diskret. */
const groupable = (c: DbColumn) => c.type === "text" || c.type === "checkbox";

interface Group {
  key: string; // id stabil untuk React & <select>
  label: string;
  value: CellValue; // nilai sel yang mewakili grup ini
}

/** Bangun daftar grup dari kolom pengelompok + baris yang ada. */
function buildGroups(db: Database, col: DbColumn): Group[] {
  if (col.type === "checkbox") {
    return [
      { key: "true", label: `✓ ${col.name}`, value: true },
      { key: "false", label: `${col.name}: belum`, value: false },
    ];
  }
  // text: nilai unik + grup "kosong".
  const seen = new Map<string, Group>();
  for (const r of db.rows) {
    const v = r.cells[col.id];
    if (typeof v === "string" && v.trim()) {
      const key = v.trim();
      if (!seen.has(key)) seen.set(key, { key, label: key, value: key });
    }
  }
  const groups = [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  groups.push({ key: "__empty", label: "(kosong)", value: null });
  return groups;
}

/** Grup tempat sebuah baris jatuh untuk kolom ini. */
function rowGroupKey(row: Database["rows"][number], col: DbColumn): string {
  const v = row.cells[col.id];
  if (col.type === "checkbox") return v === true ? "true" : "false";
  return typeof v === "string" && v.trim() ? v.trim() : "__empty";
}

export function KanbanBoard({ db }: { db: Database }) {
  const setDatabaseGroupBy = useCanvasStore((s) => s.setDatabaseGroupBy);
  const setCell = useCanvasStore((s) => s.setCell);
  const addRowInGroup = useCanvasStore((s) => s.addRowInGroup);
  const removeRow = useCanvasStore((s) => s.removeRow);

  const groupCols = db.columns.filter(groupable);
  // Default: kolom centang (paling "status"-like untuk Kanban) → lalu teks pertama.
  const groupCol =
    db.columns.find((c) => c.id === db.groupBy && groupable(c)) ??
    db.columns.find((c) => c.type === "checkbox") ??
    groupCols[0];
  const titleCol = db.columns.find((c) => c.type === "text");

  // Drag-and-drop kartu antar kolom (pointer-based, konsisten dg kanvas).
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const columnKeyAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-group-key]")?.dataset.groupKey ?? null;

  const groups = useMemo(() => (groupCol ? buildGroups(db, groupCol) : []), [db, groupCol]);
  const byGroup = useMemo(() => {
    const m = new Map<string, Database["rows"]>();
    if (!groupCol) return m;
    for (const g of groups) m.set(g.key, []);
    for (const r of db.rows) {
      const k = rowGroupKey(r, groupCol);
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return m;
  }, [db.rows, groupCol, groups]);

  const moveTo = (rowId: string, key: string | null) => {
    if (!groupCol || !key) return;
    const target = groups.find((g) => g.key === key);
    if (target) setCell(db.id, rowId, groupCol.id, target.value);
  };

  if (!groupCol) {
    return (
      <p className="p-6 text-center text-sm text-neutral-400">
        Tampilan Kanban butuh kolom teks atau centang untuk mengelompokkan.
        <br />
        Tambah satu di tampilan Tabel.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
        <span>Kelompokkan:</span>
        <select
          value={groupCol.id}
          onChange={(e) => setDatabaseGroupBy(db.id, e.target.value)}
          className="cursor-pointer rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 outline-none"
        >
          {groupCols.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {groups.map((g) => {
          const rows = byGroup.get(g.key) ?? [];
          return (
            <div
              key={g.key}
              data-group-key={g.key}
              className={[
                "flex w-60 shrink-0 flex-col rounded-md p-2 transition-colors",
                dropKey === g.key && dragRow ? "bg-blue-50 ring-1 ring-blue-300" : "bg-neutral-50",
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="truncate text-xs font-medium text-neutral-600">{g.label}</span>
                <span className="text-xs tabular-nums text-neutral-400">{rows.length}</span>
              </div>

              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onPointerDown={(e) => {
                      // Jangan mulai drag dari kontrol (judul, pemilih, tombol).
                      if ((e.target as HTMLElement).closest("input, select, button")) return;
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setDragRow(row.id);
                    }}
                    onPointerMove={(e) => {
                      if (dragRow !== row.id) return;
                      setDropKey(columnKeyAt(e.clientX, e.clientY));
                    }}
                    onPointerUp={(e) => {
                      if (dragRow === row.id) {
                        moveTo(row.id, columnKeyAt(e.clientX, e.clientY));
                        setDragRow(null);
                        setDropKey(null);
                      }
                    }}
                    className={[
                      "group touch-none rounded-md bg-white p-2 shadow-sm ring-1 ring-neutral-200",
                      dragRow === row.id ? "cursor-grabbing opacity-60" : "cursor-grab",
                    ].join(" ")}
                  >
                    {titleCol && titleCol.id !== groupCol.id ? (
                      <input
                        value={typeof row.cells[titleCol.id] === "string" ? (row.cells[titleCol.id] as string) : ""}
                        onChange={(e) => setCell(db.id, row.id, titleCol.id, e.target.value || null)}
                        placeholder="Tanpa judul"
                        className="w-full bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                      />
                    ) : (
                      <span className="text-sm text-neutral-800">Baris</span>
                    )}

                    {/* Ringkasan kolom lain (baca saja) */}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {db.columns
                        .filter((c) => c.id !== groupCol.id && c.id !== titleCol?.id)
                        .map((c) => {
                          const v = row.cells[c.id];
                          if (v == null || v === "" || v === false || Array.isArray(v)) return null;
                          const text = c.type === "checkbox" ? `✓ ${c.name}` : `${c.name}: ${v}`;
                          return (
                            <span key={c.id} className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500">
                              {text}
                            </span>
                          );
                        })}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between">
                      <select
                        value={g.key}
                        onChange={(e) => {
                          const target = groups.find((x) => x.key === e.target.value);
                          if (target) setCell(db.id, row.id, groupCol.id, target.value);
                        }}
                        title="Pindahkan ke grup lain"
                        className="cursor-pointer rounded bg-neutral-50 text-[11px] text-neutral-500 outline-none"
                      >
                        {groups.map((x) => (
                          <option key={x.key} value={x.key}>
                            → {x.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeRow(db.id, row.id)}
                        title="Hapus baris"
                        className="text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addRowInGroup(db.id, groupCol.id, g.value)}
                className="mt-2 rounded px-1 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                + baris
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
