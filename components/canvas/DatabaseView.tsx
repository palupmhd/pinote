"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import type { CellValue, ColumnType, DbColumn } from "@/lib/types";

const TYPE_LABEL: Record<ColumnType, string> = {
  text: "Teks",
  number: "Angka",
  checkbox: "Centang",
  date: "Tanggal",
};

/** Satu sel yang bisa diedit, bentuk kontrolnya ikut tipe kolom. */
function CellEditor({
  dbId,
  rowId,
  column,
  value,
}: {
  dbId: string;
  rowId: string;
  column: DbColumn;
  value: CellValue;
}) {
  const setCell = useCanvasStore((s) => s.setCell);
  const set = (v: CellValue) => setCell(dbId, rowId, column.id, v);

  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => set(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-blue-500"
      />
    );
  }
  if (column.type === "number") {
    return (
      <input
        type="number"
        value={value == null ? "" : String(value)}
        onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full bg-transparent text-sm text-neutral-800 outline-none tabular-nums"
      />
    );
  }
  if (column.type === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => set(e.target.value || null)}
        className="w-full bg-transparent text-sm text-neutral-800 outline-none"
      />
    );
  }
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => set(e.target.value || null)}
      className="w-full bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
    />
  );
}

/** Header kolom: ganti nama, ganti tipe, hapus. */
function ColumnHeader({ dbId, column }: { dbId: string; column: DbColumn }) {
  const renameColumn = useCanvasStore((s) => s.renameColumn);
  const setColumnType = useCanvasStore((s) => s.setColumnType);
  const removeColumn = useCanvasStore((s) => s.removeColumn);

  return (
    <div className="flex items-center gap-1">
      <input
        value={column.name}
        onChange={(e) => renameColumn(dbId, column.id, e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-600 outline-none"
      />
      <select
        value={column.type}
        onChange={(e) => setColumnType(dbId, column.id, e.target.value as ColumnType)}
        title="Tipe kolom"
        className="shrink-0 cursor-pointer rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500 outline-none"
      >
        {(Object.keys(TYPE_LABEL) as ColumnType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <button
        onClick={() => removeColumn(dbId, column.id)}
        title="Hapus kolom"
        className="shrink-0 px-1 text-neutral-300 hover:text-red-500"
      >
        ✕
      </button>
    </div>
  );
}

/** Editor tabel penuh untuk satu Database (spec §8.4). Dibuka dari kartu
 *  DATABASE_REF; overlay, bukan kanvas bersarang. */
export function DatabaseView() {
  const openId = useUiStore((s) => s.openDatabaseId);
  const close = useUiStore((s) => s.closeDatabase);
  const db = useCanvasStore((s) => (openId ? s.databases[openId] : undefined));
  const renameDatabase = useCanvasStore((s) => s.renameDatabase);
  const addColumn = useCanvasStore((s) => s.addColumn);
  const addRow = useCanvasStore((s) => s.addRow);
  const removeRow = useCanvasStore((s) => s.removeRow);

  // Esc menutup editor (tapi tidak saat sedang mengetik di sel — biar Esc di
  // input tak sengaja menutup seluruh tabel).
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable) {
        (t as HTMLElement).blur();
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  // Tabel bisa terhapus (mis. via undo) selagi terbuka → tutup dengan aman.
  if (!openId || !db) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-6">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <input
            value={db.title}
            onChange={(e) => renameDatabase(db.id, e.target.value)}
            placeholder="Judul database"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-neutral-800 outline-none placeholder:text-neutral-300"
          />
          <button
            onClick={close}
            className="ml-2 shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {db.columns.map((c) => (
                  <th
                    key={c.id}
                    className="min-w-[140px] border-r border-neutral-100 px-3 py-2 align-middle"
                  >
                    <ColumnHeader dbId={db.id} column={c} />
                  </th>
                ))}
                <th className="w-10 px-2 py-2">
                  <button
                    onClick={() => addColumn(db.id)}
                    title="Tambah kolom"
                    className="rounded px-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                  >
                    +
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {db.rows.map((row) => (
                <tr key={row.id} className="group border-b border-neutral-100 hover:bg-neutral-50/60">
                  {db.columns.map((c) => (
                    <td key={c.id} className="border-r border-neutral-100 px-3 py-1.5 align-middle">
                      <CellEditor dbId={db.id} rowId={row.id} column={c} value={row.cells[c.id] ?? null} />
                    </td>
                  ))}
                  <td className="px-2 text-center align-middle">
                    <button
                      onClick={() => removeRow(db.id, row.id)}
                      title="Hapus baris"
                      className="text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {db.columns.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-400">
              Belum ada kolom. Klik + di kanan atas tabel untuk menambah.
            </p>
          )}
        </div>

        <div className="border-t border-neutral-200 px-4 py-2">
          <button
            onClick={() => addRow(db.id)}
            className="rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            + Tambah baris
          </button>
        </div>
      </div>
    </div>
  );
}
