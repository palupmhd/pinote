"use client";

import { useMemo, useRef, useState } from "react";
import { ColumnTypeGrid, COLUMN_TYPE_ICON } from "./ColumnTypePicker";
import { FloatingPopover } from "./FloatingPopover";
import { IconPlus } from "./icons";
import { computeFormula, FORMULA_PRESETS } from "@/lib/formula";
import { computeRollup } from "@/lib/rollup";
import { useCanvasStore } from "@/lib/store";
import type { CellValue, ColumnType, Database, DbColumn, DbRow, FormulaPreset, RollupOp } from "@/lib/types";

const ROLLUP_OPS: Record<RollupOp, string> = {
  count: "Jumlah tautan",
  sum: "Total",
  avg: "Rata-rata",
  min: "Minimum",
  max: "Maksimum",
};

/** Sel rollup: nilai dihitung dari relasi, baca saja (spec §7.1). Terima
 *  `row` langsung (bukan rowId) — pemanggil (baris tabel) sudah punya
 *  objeknya di tangan lewat db.rows.map, jadi tak perlu .find() ulang yang
 *  jadi O(N) per sel dan O(N²) untuk seluruh kolom rollup di tabel. */
function RollupCell({ dbId, row, column }: { dbId: string; row: DbRow; column: DbColumn }) {
  const databases = useCanvasStore((s) => s.databases);
  const db = databases[dbId];
  if (!db) return null;
  if (!column.rollupRelationId) {
    return <span className="text-xs text-neutral-300">atur di header</span>;
  }
  const v = computeRollup(db, row, column, databases);
  return <span className="text-sm tabular-nums text-neutral-700">{v == null ? "—" : v}</span>;
}

/** Sel formula: nilai dihitung dari kolom lain lewat preset, baca saja (§7.1).
 *  Subscribe ke database supaya ikut berubah saat sel sumber berubah. Terima
 *  `row` langsung — alasan sama seperti RollupCell di atas. */
function FormulaCell({ dbId, row, column }: { dbId: string; row: DbRow; column: DbColumn }) {
  const db = useCanvasStore((s) => s.databases[dbId]);
  if (!db) return null;
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
 *  tidak ada pakai nomor urut. Dipakai untuk chip & pemilih relasi.
 *
 *  Terima `textCol` yang SUDAH dicari (bukan `db` mentah): pemanggil di bawah
 *  memanggil ini sekali per BARIS (chip tertaut + tiap opsi dropdown), dan
 *  `db.columns.find(...)` yang tadinya di dalam sini akan berulang identik
 *  untuk semua baris di database yang sama — kolom teks pertamanya tak pernah
 *  beda antar baris. */
function rowLabel(textCol: DbColumn | undefined, row: DbRow, index: number): string {
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
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!column.targetDatabaseId) {
    return <span className="text-xs text-neutral-300">pilih database tujuan di header</span>;
  }
  if (!target) {
    return <span className="text-xs text-red-400">database tujuan hilang</span>;
  }

  // Indeks id→urutan dibangun sekali. Versi lama memindai `target.rows` secara
  // linear DUA kali per chip (`some` untuk menyaring, lalu `findIndex` untuk
  // labelnya), jadi biayanya tumbuh sebagai tautan × baris di tiap render sel.
  const indexOf = new Map(target.rows.map((r, i) => [r.id, i] as const));
  const textCol = target.columns.find((c) => c.type === "text");

  return (
    <div className="flex flex-wrap items-center gap-1">
      {linked
        .filter((rid) => indexOf.has(rid))
        .map((rid) => {
          const idx = indexOf.get(rid)!;
          return (
          <button
            key={rid}
            onClick={() => toggleRelation(dbId, rowId, column.id, rid)}
            title="Klik untuk lepas"
            className="rounded bg-forest-50 px-1.5 py-0.5 text-xs text-forest-800 hover:bg-red-50 hover:text-red-600"
          >
            {rowLabel(textCol, target.rows[idx], idx)} ✕
          </button>
          );
        })}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        + tautkan
      </button>
      {/* Portal + posisi fixed (lihat FloatingPopover) — sel ini hidup di
          dalam tabel overflow-auto; popover position:absolute biasa di sini
          akan ikut terpotong saat tabel discroll, persis bug yang sudah
          diperbaiki di menu "Lainnya" Toolbar.tsx. */}
      <FloatingPopover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={176}>
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
                className="h-3.5 w-3.5 accent-forest-600"
              />
              <span className="truncate text-neutral-700">{rowLabel(textCol, r, i)}</span>
            </label>
          ))
        )}
      </FloatingPopover>
    </div>
  );
}

/** Satu sel yang bisa diedit, bentuk kontrolnya ikut tipe kolom. */
function CellEditor({
  dbId,
  rowId,
  row,
  column,
  value,
}: {
  dbId: string;
  rowId: string;
  row: DbRow;
  column: DbColumn;
  value: CellValue;
}) {
  const setCell = useCanvasStore((s) => s.setCell);
  const set = (v: CellValue) => setCell(dbId, rowId, column.id, v);

  if (column.type === "relation") {
    return <RelationCell dbId={dbId} rowId={rowId} column={column} value={value} />;
  }
  if (column.type === "rollup") {
    return <RollupCell dbId={dbId} row={row} column={column} />;
  }
  if (column.type === "formula") {
    return <FormulaCell dbId={dbId} row={row} column={column} />;
  }
  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => set(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-forest-600"
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
  // sendiri): tanggal→date, hitung angka→number, concat→teks/angka/tanggal.
  // Kolom TERHITUNG (formula/rollup) sengaja tak pernah ditawarkan: nilainya
  // dihitung saat render dan tak pernah disimpan di `cells`, jadi memilihnya
  // selalu menghasilkan sel kosong — jebakan diam yang tampak seperti bug.
  const formulaCands = useMemo(() => {
    const cols = (databases[dbId]?.columns ?? []).filter(
      (c) => c.id !== column.id && c.type !== "formula" && c.type !== "rollup"
    );
    const p = column.formulaPreset;
    if (p === "days_until" || p === "date_status") return cols.filter((c) => c.type === "date");
    if (p === "sum" || p === "diff" || p === "product" || p === "percent")
      return cols.filter((c) => c.type === "number");
    // concat: relasi tak punya representasi teks yang berguna (array id).
    return cols.filter((c) => c.type !== "relation");
  }, [databases, dbId, column.id, column.formulaPreset]);
  const formulaInputs = column.formulaPreset ? FORMULA_PRESETS[column.formulaPreset].inputs : 0;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const Icon = COLUMN_TYPE_ICON[column.type];

  return (
    <>
      {/* Kolaps: ikon tipe + nama saja — dulu SEMUA kontrol (nama, tipe, &
          config per-tipe) selalu terbuka sekaligus di tiap header, ramai &
          padat. Klik untuk buka popover ubah nama/tipe/config, gaya Notion
          (klik header kolom → menu properti), bukan select mentah yang
          selalu kelihatan. */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        title="Klik untuk ubah nama/tipe kolom"
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-neutral-100"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600">{column.name}</span>
      </button>

      <FloatingPopover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <input
          autoFocus
          value={column.name}
          onChange={(e) => renameColumn(dbId, column.id, e.target.value)}
          placeholder="Nama kolom"
          className="mb-1.5 w-full rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-forest-300"
        />

        <p className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Tipe</p>
        <ColumnTypeGrid value={column.type} onPick={(t) => setColumnType(dbId, column.id, t)} />

        {column.type === "relation" && (
          <div className="mt-1.5 border-t border-neutral-100 pt-1.5">
            <select
              value={column.targetDatabaseId ?? ""}
              onChange={(e) => setColumnTarget(dbId, column.id, e.target.value)}
              title="Database tujuan relasi"
              className="w-full cursor-pointer rounded bg-forest-50 px-2 py-1 text-xs text-forest-800 outline-none"
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
          </div>
        )}
        {column.type === "rollup" && (
          <div className="mt-1.5 flex flex-col gap-1 border-t border-neutral-100 pt-1.5">
            <select
              value={column.rollupRelationId ?? ""}
              onChange={(e) => setRollup(dbId, column.id, { rollupRelationId: e.target.value })}
              title="Lewat kolom relasi mana"
              className="w-full cursor-pointer rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 outline-none"
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
              className="w-full cursor-pointer rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 outline-none"
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
                className="w-full cursor-pointer rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 outline-none"
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
          <div className="mt-1.5 flex flex-col gap-1 border-t border-neutral-100 pt-1.5">
            <select
              value={column.formulaPreset ?? ""}
              onChange={(e) =>
                setFormula(dbId, column.id, { formulaPreset: (e.target.value || undefined) as FormulaPreset })
              }
              title="Preset formula"
              className="w-full cursor-pointer rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 outline-none"
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
                className="w-full cursor-pointer rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 outline-none"
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
                className="w-full cursor-pointer rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 outline-none"
              >
                <option value="" disabled>→ kolom B…</option>
                {formulaCands.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="my-1.5 h-px bg-neutral-100" />
        <button
          onClick={() => {
            removeColumn(dbId, column.id);
            setOpen(false);
          }}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-red-500 hover:bg-red-50"
        >
          Hapus kolom
        </button>
      </FloatingPopover>
    </>
  );
}

/** Tombol "+" tambah kolom: dulu langsung membuat "Kolom N" bertipe teks
 *  tanpa jeda, dinamai/ditipekan belakangan lewat ColumnHeader. Sekarang gaya
 *  Notion — nama dulu (opsional, boleh dikosongkan), lalu pilih tipe dari
 *  daftar berikon; keduanya dikirim SEKALIGUS saat tipe dipilih (addColumn
 *  lalu renameColumn, satu gestur). Enter di field nama = buat sebagai teks,
 *  jalan pintas buat yang tak peduli tipe (perilaku lama, tetap tersedia). */
function AddColumnButton({ dbId }: { dbId: string }) {
  const addColumn = useCanvasStore((s) => s.addColumn);
  const renameColumn = useCanvasStore((s) => s.renameColumn);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  const create = (type: ColumnType) => {
    const id = addColumn(dbId, type);
    if (id && name.trim()) renameColumn(dbId, id, name.trim());
    setName("");
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Tambah kolom"
        className="rounded px-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
      >
        +
      </button>
      <FloatingPopover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} align="end">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create("text");
          }}
          placeholder="Nama kolom (opsional)"
          className="mb-1.5 w-full rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-forest-300"
        />
        <p className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Tipe</p>
        <ColumnTypeGrid onPick={create} />
      </FloatingPopover>
    </>
  );
}

/** Tampilan Tabel penuh (spec §7.3) — diekstrak dari DatabaseView.tsx supaya
 *  bisa dipakai ulang baik di modal maupun sebagai kartu DATABASE_VIEW di
 *  kanvas, sama seperti Kanban/Kalender/Galeri/Spasial yang sudah lebih dulu
 *  jadi komponen lepas. */
export function TableBoard({ db, onOpenRowCanvas }: { db: Database; onOpenRowCanvas: (rowId: string) => void }) {
  const addRow = useCanvasStore((s) => s.addRow);
  const removeRow = useCanvasStore((s) => s.removeRow);

  return (
    <div className="flex h-full flex-col">
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
                <AddColumnButton dbId={db.id} />
              </th>
            </tr>
          </thead>
          <tbody>
            {db.rows.map((row) => (
              <tr key={row.id} className="group border-b border-neutral-100 hover:bg-neutral-50/60">
                {db.columns.map((c) => (
                  <td key={c.id} className="border-r border-neutral-100 px-3 py-1.5 align-middle">
                    <CellEditor dbId={db.id} rowId={row.id} row={row} column={c} value={row.cells[c.id] ?? null} />
                  </td>
                ))}
                <td className="whitespace-nowrap px-2 text-center align-middle">
                  <button
                    onClick={() => onOpenRowCanvas(row.id)}
                    title={row.boardId ? "Buka kanvas baris" : "Buka baris sebagai kanvas"}
                    className={[
                      "px-1",
                      row.boardId
                        ? "text-forest-600 hover:text-forest-800"
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
          className="flex items-center gap-1.5 rounded-md bg-forest-50 px-3 py-1.5 text-sm font-medium text-forest-700 hover:bg-forest-100"
        >
          <IconPlus className="h-3.5 w-3.5" /> Tambah baris
        </button>
      </div>
    </div>
  );
}
