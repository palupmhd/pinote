"use client";

import { useRef, useState } from "react";
import { todayStr } from "@/lib/dates";
import { useCanvasStore } from "@/lib/store";
import type { Database, DbColumn } from "@/lib/types";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;

/** 42 hari (6 minggu) mulai dari Minggu di/ sebelum tanggal 1. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Kelompokkan baris per tanggal ("YYYY-MM-DD"). Murni & di scope modul supaya
 *  React Compiler yang menangani memoisasi, tanpa useMemo manual. */
function bucketByDay(db: Database, dateCol: DbColumn): Map<string, Database["rows"]> {
  const m = new Map<string, Database["rows"]>();
  for (const r of db.rows) {
    const v = r.cells[dateCol.id];
    if (typeof v !== "string" || !v) continue;
    (m.get(v) ?? m.set(v, []).get(v)!).push(r);
  }
  return m;
}

/** "2026-08-15" → "Sabtu, 15 Agustus 2026". Key kosong/invalid → "". */
function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return "";
  const wd = WEEKDAYS_LONG[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${d} ${MONTHS[m - 1]} ${y}`;
}

const WEEKDAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function CalendarBoard({ db }: { db: Database }) {
  const setDatabaseDateBy = useCanvasStore((s) => s.setDatabaseDateBy);
  const addRowInGroup = useCanvasStore((s) => s.addRowInGroup);
  const setCell = useCanvasStore((s) => s.setCell);
  const removeRow = useCanvasStore((s) => s.removeRow);

  const dateCols = db.columns.filter((c) => c.type === "date");
  const dateCol: DbColumn | undefined =
    db.columns.find((c) => c.id === db.dateBy && c.type === "date") ?? dateCols[0];
  const titleCol = db.columns.find((c) => c.type === "text");

  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [openDay, setOpenDay] = useState<string | null>(null); // tanggal yang drawer-nya terbuka

  // Drag baris antar tanggal (pointer-based via elementFromPoint, konsisten dg
  // Kanban). draggedRef membedakan geser-antar-hari dari tap: tap membuka drawer,
  // geser memindah tanggal — supaya keyboard/klik tetap jalan.
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const draggedRef = useRef(false);
  const dayKeyAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day-key]")?.dataset.dayKey ?? null;

  const byDay = dateCol ? bucketByDay(db, dateCol) : new Map<string, Database["rows"]>();

  if (!dateCol) {
    return (
      <p className="p-6 text-center text-sm text-neutral-400">
        Tampilan Kalender butuh kolom bertipe Tanggal.
        <br />
        Tambah satu di tampilan Tabel.
      </p>
    );
  }

  const days = monthGrid(ym.year, ym.month);
  const today = todayStr();
  const label = (r: Database["rows"][number]) => {
    const v = titleCol ? r.cells[titleCol.id] : null;
    return typeof v === "string" && v.trim() ? v.trim() : "Baris";
  };
  const shift = (delta: number) => {
    const d = new Date(ym.year, ym.month + delta, 1);
    setYm({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2 text-sm">
        <button onClick={() => shift(-1)} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100" title="Bulan sebelumnya">‹</button>
        <span className="min-w-[9rem] text-center font-medium text-neutral-700">
          {MONTHS[ym.month]} {ym.year}
        </span>
        <button onClick={() => shift(1)} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100" title="Bulan berikutnya">›</button>
        <button
          onClick={() => setYm({ year: now.getFullYear(), month: now.getMonth() })}
          className="rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100"
        >
          Hari ini
        </button>
        {dateCols.length > 1 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
            Berdasarkan:
            <select
              value={dateCol.id}
              onChange={(e) => setDatabaseDateBy(db.id, e.target.value)}
              className="cursor-pointer rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 outline-none"
            >
              {dateCols.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </span>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-neutral-100 text-center text-[11px] text-neutral-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-auto">
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === ym.month;
          const isToday = key === today;
          const rows = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              data-day-key={key}
              className={[
                "group min-h-[64px] border-b border-r border-neutral-100 p-1 text-xs transition-colors",
                dragRow && dropKey === key
                  ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                  : inMonth ? "bg-white" : "bg-neutral-50/60",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span
                  className={[
                    "px-1 tabular-nums",
                    isToday ? "rounded-full bg-indigo-500 text-white" : inMonth ? "text-neutral-500" : "text-neutral-300",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                <button
                  onClick={() => addRowInGroup(db.id, dateCol.id, key)}
                  title="Tambah baris di tanggal ini"
                  className="px-1 text-neutral-300 opacity-0 hover:text-neutral-700 group-hover:opacity-100"
                >
                  +
                </button>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {rows.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    onPointerDown={(e) => {
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      draggedRef.current = false;
                      setDragRow(r.id);
                    }}
                    onPointerMove={(e) => {
                      if (dragRow !== r.id) return;
                      const k = dayKeyAt(e.clientX, e.clientY);
                      setDropKey(k);
                      if (k && k !== key) draggedRef.current = true;
                    }}
                    onPointerUp={(e) => {
                      if (dragRow !== r.id) return;
                      const k = dayKeyAt(e.clientX, e.clientY);
                      if (k && k !== key) setCell(db.id, r.id, dateCol.id, k); // pindah tanggal
                      setDragRow(null);
                      setDropKey(null);
                    }}
                    onPointerCancel={() => {
                      setDragRow(null);
                      setDropKey(null);
                    }}
                    onClick={() => {
                      if (draggedRef.current) {
                        draggedRef.current = false; // geser, bukan tap → jangan buka drawer
                        return;
                      }
                      setOpenDay(key);
                    }}
                    title="Seret untuk pindah tanggal · klik untuk lihat/edit"
                    className={[
                      "block w-full touch-none truncate rounded bg-indigo-50 px-1 py-0.5 text-left text-[11px] text-indigo-700 hover:bg-indigo-100",
                      dragRow === r.id ? "cursor-grabbing opacity-60" : "cursor-grab",
                    ].join(" ")}
                  >
                    {label(r)}
                  </button>
                ))}
                {rows.length > 3 && (
                  <button
                    onClick={() => setOpenDay(key)}
                    className="px-1 text-[10px] text-neutral-400 hover:text-neutral-700"
                  >
                    +{rows.length - 3} lagi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer hari: daftar penuh baris di satu tanggal, bisa edit/hapus/tambah
          — jalan keluar dari batas "3 item + N lagi" per sel. */}
      {openDay && (
        <div className="absolute inset-y-0 right-0 z-10 flex w-72 max-w-full flex-col border-l border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-sm font-medium text-neutral-700">{longDate(openDay)}</span>
            <button
              onClick={() => setOpenDay(null)}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {(byDay.get(openDay) ?? []).length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-neutral-400">Belum ada baris.</p>
            ) : (
              (byDay.get(openDay) ?? []).map((r) => (
                <div key={r.id} className="group flex items-center gap-1 rounded px-1 hover:bg-neutral-50">
                  {titleCol ? (
                    <input
                      value={typeof r.cells[titleCol.id] === "string" ? (r.cells[titleCol.id] as string) : ""}
                      onChange={(e) => setCell(db.id, r.id, titleCol.id, e.target.value || null)}
                      placeholder="Tanpa judul"
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    />
                  ) : (
                    <span className="flex-1 py-1 text-sm text-neutral-500">Baris</span>
                  )}
                  <button
                    onClick={() => removeRow(db.id, r.id)}
                    title="Hapus baris"
                    className="shrink-0 px-1 text-neutral-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => addRowInGroup(db.id, dateCol.id, openDay)}
            className="border-t border-neutral-100 px-3 py-2 text-left text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
          >
            + Tambah baris di tanggal ini
          </button>
        </div>
      )}
    </div>
  );
}
