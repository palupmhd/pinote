"use client";

import { useEffect, useMemo } from "react";
import { computeFormula, FORMULA_PRESETS } from "@/lib/formula";
import { computeRollup } from "@/lib/rollup";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import type { CellValue, ColumnType, Database, DbColumn, DbRow, FormulaPreset, RollupOp } from "@/lib/types";
import { CalendarBoard } from "./CalendarBoard";
import { GalleryBoard } from "./GalleryBoard";
import { KanbanBoard } from "./KanbanBoard";
import { SpatialBoard } from "./SpatialBoard";

const TYPE_LABEL: Record<ColumnType, string> = {
  text: "Teks",
  number: "Angka",
  checkbox: "Centang",
  date: "Tanggal",
  relation: "Relasi",
  rollup: "Rollup",
  formula: "Formula",
};

const ROLLUP_OPS: Record<RollupOp, string> = {
  count: "Jumlah tautan",
  sum: "Total",
  avg: "Rata-rata",
  min: "Minimum",
  max: "Maksimum",
};

/** Sel rollup: nilai dihitung dari relasi, baca saja (spec §7.1). */
function RollupCell({ dbId, rowId, column }: { dbId: string; rowId: string; column: DbColumn }) {
  const databases = useCanvasStore((s) => s.databases);
  const db = databases[dbId];
  const row = db?.rows.find((r) => r.id === rowId);
  if (!db || !row) return null;
  if (!column.rollupRelationId) {
    return <span className="text-xs text-neutral-300">atur di header</span>;
  }
  const v = computeRollup(db, row, column, databases);
  return <span className="text-sm tabular-nums text-neutral-700">{v == null ? "—" : v}</span>;
}

/** Sel formula: nilai dihitung dari kolom lain lewat preset, baca saja (§7.1).
 *  Subscribe ke database supaya ikut berubah saat sel sumber berubah. */
function FormulaCell({ dbId, rowId, column }: { dbId: string; rowId: string; column: DbColumn }) {
  const db = useCanvasStore((s) => s.databases[dbId]);
  const row = db?.rows.find((r) => r.id === rowId);
  if (!db || !row) return null;
  if (!column.formulaPreset) {
    return <span className="text-xs text-neutral-300">atur di header</span>;
  }
  const v = computeFormula(row, column);
  if (v == null) return <span className="text-sm text-neutral-300">—</span>;
  return (
    <span className={`text-sm text-neutral-700 ${typeof v === "number" ? "tabular-nums" : ""}`}>{v}</span>
  );
}

/** Label ringkas sebuah baris: nilai kolom teks pertama yang terisi, kalau
 *  tidak ada pakai nomor urut. Dipakai untuk chip & pemilih relasi. */
function rowLabel(db: Database, row: DbRow, index: number): string {
  const textCol = db.columns.find((c) => c.type === "text");
  const v = textCol ? row.cells[textCol.id] : null;
  if (typeof v === "string" && v.trim()) return v.trim();
  return `Baris ${index + 1}`;
}

/** Sel relasi: chip baris tertaut + pemilih untuk menautkan/melepas (spec §8.6). */
function RelationCell({
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
  const target = useCanvasStore((s) =>
    column.targetDatabaseId ? s.databases[column.targetDatabaseId] : undefined
  );
  const toggleRelation = useCanvasStore((s) => s.toggleRelation);
  const linked = Array.isArray(value) ? value : [];

  if (!column.targetDatabaseId) {
    return <span className="text-xs text-neutral-300">pilih database tujuan di header</span>;
  }
  if (!target) {
    return <span className="text-xs text-red-400">database tujuan hilang</span>;
  }

  const labelFor = (rid: string) => {
    const idx = target.rows.findIndex((r) => r.id === rid);
    return idx < 0 ? "?" : rowLabel(target, target.rows[idx], idx);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {linked
        .filter((rid) => target.rows.some((r) => r.id === rid))
        .map((rid) => (
          <button
            key={rid}
            onClick={() => toggleRelation(dbId, rowId, column.id, rid)}
            title="Klik untuk lepas"
            className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700 hover:bg-red-50 hover:text-red-600"
          >
            {labelFor(rid)} ✕
          </button>
        ))}
      <details className="relative">
        <summary className="cursor-pointer list-none rounded px-1 text-xs text-neutral-400 hover:text-neutral-700">
          + tautkan
        </summary>
        <div className="absolute z-10 mt-1 max-h-48 w-44 overflow-auto rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
          {target.rows.length === 0 ? (
            <p className="px-2 py-1 text-xs text-neutral-400">Tabel tujuan kosong</p>
          ) : (
            target.rows.map((r, i) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-neutral-100"
              >
                <input
                  type="checkbox"
                  checked={linked.includes(r.id)}
                  onChange={() => toggleRelation(dbId, rowId, column.id, r.id)}
                  className="h-3.5 w-3.5 accent-indigo-500"
                />
                <span className="truncate text-neutral-700">{rowLabel(target, r, i)}</span>
              </label>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

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

  if (column.type === "relation") {
    return <RelationCell dbId={dbId} rowId={rowId} column={column} value={value} />;
  }
  if (column.type === "rollup") {
    return <RollupCell dbId={dbId} rowId={rowId} column={column} />;
  }
  if (column.type === "formula") {
    return <FormulaCell dbId={dbId} rowId={rowId} column={column} />;
  }
  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => set(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-indigo-500"
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

/** Header kolom: ganti nama, ganti tipe, hapus. Untuk kolom relasi, tampilkan
 *  pemilih database tujuan. */
function ColumnHeader({ dbId, column }: { dbId: string; column: DbColumn }) {
  const renameColumn = useCanvasStore((s) => s.renameColumn);
  const setColumnType = useCanvasStore((s) => s.setColumnType);
  const setColumnTarget = useCanvasStore((s) => s.setColumnTarget);
  const setRollup = useCanvasStore((s) => s.setRollup);
  const setFormula = useCanvasStore((s) => s.setFormula);
  const removeColumn = useCanvasStore((s) => s.removeColumn);
  // Kandidat database tujuan: semua database selain diri sendiri. Pilih objek
  // databases yang stabil lalu turunkan daftar via useMemo — mengembalikan array
  // baru langsung di selector memicu loop tak berujung di zustand v5.
  const databases = useCanvasStore((s) => s.databases);
  // Termasuk database ini sendiri: relasi self-referencing sah (mis. dependensi
  // antar-baris) dan digambar sebagai panah di tampilan Spatial. Panah kanvas
  // utama sudah mengabaikan self-loop kartu yang sama.
  const targets = useMemo(
    () =>
      Object.values(databases).map((d) => ({
        id: d.id,
        title: d.id === dbId ? `${d.title} (ini sendiri)` : d.title,
      })),
    [databases, dbId]
  );
  // Untuk konfigurasi rollup: kolom relasi database ini, & kolom angka di
  // database tujuan relasi terpilih.
  const relationCols = useMemo(
    () => databases[dbId]?.columns.filter((c) => c.type === "relation") ?? [],
    [databases, dbId]
  );
  const rollupRelCol = relationCols.find((c) => c.id === column.rollupRelationId);
  const numberCols = useMemo(() => {
    const tid = rollupRelCol?.targetDatabaseId;
    return tid ? (databases[tid]?.columns.filter((c) => c.type === "number") ?? []) : [];
  }, [databases, rollupRelCol]);
  // Kolom input yang cocok untuk preset formula terpilih (jangan pilih diri
  // sendiri): tanggal→date, hitung angka→number, concat→apa saja.
  const formulaCands = useMemo(() => {
    const cols = (databases[dbId]?.columns ?? []).filter((c) => c.id !== column.id);
    const p = column.formulaPreset;
    if (p === "days_until" || p === "date_status") return cols.filter((c) => c.type === "date");
    if (p === "sum" || p === "diff" || p === "product" || p === "percent")
      return cols.filter((c) => c.type === "number");
    return cols; // concat / belum pilih preset
  }, [databases, dbId, column.id, column.formulaPreset]);
  const formulaInputs = column.formulaPreset ? FORMULA_PRESETS[column.formulaPreset].inputs : 0;

  return (
    <div className="space-y-1">
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
      {column.type === "relation" && (
        <select
          value={column.targetDatabaseId ?? ""}
          onChange={(e) => setColumnTarget(dbId, column.id, e.target.value)}
          title="Database tujuan relasi"
          className="w-full cursor-pointer rounded bg-indigo-50 px-1 py-0.5 text-[10px] text-indigo-700 outline-none"
        >
          <option value="" disabled>
            → database tujuan…
          </option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}
      {column.type === "rollup" && (
        <div className="space-y-1">
          <select
            value={column.rollupRelationId ?? ""}
            onChange={(e) => setRollup(dbId, column.id, { rollupRelationId: e.target.value })}
            title="Lewat kolom relasi mana"
            className="w-full cursor-pointer rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700 outline-none"
          >
            <option value="" disabled>→ lewat relasi…</option>
            {relationCols.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={column.rollupOp ?? "count"}
            onChange={(e) => setRollup(dbId, column.id, { rollupOp: e.target.value as RollupOp })}
            title="Fungsi rollup"
            className="w-full cursor-pointer rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
          >
            {(Object.keys(ROLLUP_OPS) as RollupOp[]).map((op) => (
              <option key={op} value={op}>{ROLLUP_OPS[op]}</option>
            ))}
          </select>
          {(column.rollupOp ?? "count") !== "count" && (
            <select
              value={column.rollupTargetColumnId ?? ""}
              onChange={(e) => setRollup(dbId, column.id, { rollupTargetColumnId: e.target.value })}
              title="Kolom angka di database tujuan"
              className="w-full cursor-pointer rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
            >
              <option value="" disabled>→ kolom angka…</option>
              {numberCols.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
      {column.type === "formula" && (
        <div className="space-y-1">
          <select
            value={column.formulaPreset ?? ""}
            onChange={(e) =>
              setFormula(dbId, column.id, { formulaPreset: (e.target.value || undefined) as FormulaPreset })
            }
            title="Preset formula"
            className="w-full cursor-pointer rounded bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-700 outline-none"
          >
            <option value="" disabled>→ pilih preset…</option>
            {(Object.keys(FORMULA_PRESETS) as FormulaPreset[]).map((p) => (
              <option key={p} value={p}>{FORMULA_PRESETS[p].label}</option>
            ))}
          </select>
          {formulaInputs >= 1 && (
            <select
              value={column.formulaColA ?? ""}
              onChange={(e) => setFormula(dbId, column.id, { formulaColA: e.target.value })}
              title="Kolom input A"
              className="w-full cursor-pointer rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
            >
              <option value="" disabled>→ kolom A…</option>
              {formulaCands.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {formulaInputs >= 2 && (
            <select
              value={column.formulaColB ?? ""}
              onChange={(e) => setFormula(dbId, column.id, { formulaColB: e.target.value })}
              title="Kolom input B"
              className="w-full cursor-pointer rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
            >
              <option value="" disabled>→ kolom B…</option>
              {formulaCands.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
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
  const openRowAsBoard = useCanvasStore((s) => s.openRowAsBoard);
  const setDatabaseView = useCanvasStore((s) => s.setDatabaseView);

  // Buka isi kanvas sebuah baris: bikin/buka board bersarang lalu tutup overlay
  // ini supaya kanvas board baru kelihatan (spec §7.2, irisan tipis).
  const openRowCanvas = (rowId: string) => {
    if (openRowAsBoard(db!.id, rowId)) close();
  };

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
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-0 sm:p-6">
      {/* Layar kecil: modal penuh layar tanpa sudut/pinggir; sm+: kartu terpusat. */}
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-full sm:rounded-lg">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <input
            value={db.title}
            onChange={(e) => renameDatabase(db.id, e.target.value)}
            placeholder="Judul database"
            className="order-1 min-w-0 flex-1 basis-40 bg-transparent text-base font-semibold text-neutral-800 outline-none placeholder:text-neutral-300"
          />
          <button
            onClick={close}
            className="order-2 shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 sm:order-3"
            aria-label="Tutup"
          >
            ✕
          </button>
          {/* Pengalih tampilan (spec §7.3). Di layar sempit: baris sendiri, bisa
              digeser horizontal supaya tak menekan judul. */}
          <div className="order-3 w-full overflow-x-auto sm:order-2 sm:w-auto">
            <div className="flex w-max rounded-md bg-neutral-100 p-0.5 text-xs">
              {(["table", "kanban", "calendar", "gallery", "spatial"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDatabaseView(db.id, v)}
                  className={[
                    "shrink-0 whitespace-nowrap rounded px-2 py-1",
                    (db.view ?? "table") === v ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500",
                  ].join(" ")}
                >
                  {v === "table" ? "Tabel" : v === "kanban" ? "Kanban" : v === "calendar" ? "Kalender" : v === "gallery" ? "Galeri" : "Spasial"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(db.view ?? "table") === "kanban" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <KanbanBoard db={db} />
          </div>
        ) : (db.view ?? "table") === "calendar" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <CalendarBoard db={db} />
          </div>
        ) : (db.view ?? "table") === "gallery" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <GalleryBoard db={db} onOpenRowCanvas={openRowCanvas} />
          </div>
        ) : (db.view ?? "table") === "spatial" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SpatialBoard db={db} onOpenRowCanvas={openRowCanvas} />
          </div>
        ) : (
        <>
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
                  <td className="whitespace-nowrap px-2 text-center align-middle">
                    <button
                      onClick={() => openRowCanvas(row.id)}
                      title={row.boardId ? "Buka kanvas baris" : "Buka baris sebagai kanvas"}
                      className={[
                        "px-1",
                        row.boardId
                          ? "text-indigo-500 hover:text-indigo-700"
                          : "text-neutral-300 opacity-0 hover:text-neutral-700 group-hover:opacity-100",
                      ].join(" ")}
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
        </>
        )}
      </div>
    </div>
  );
}
