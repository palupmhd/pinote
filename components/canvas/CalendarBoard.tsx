"use client";

import { useState } from "react";
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

export function CalendarBoard({ db }: { db: Database }) {
  const setDatabaseDateBy = useCanvasStore((s) => s.setDatabaseDateBy);
  const addRowInGroup = useCanvasStore((s) => s.addRowInGroup);

  const dateCols = db.columns.filter((c) => c.type === "date");
  const dateCol: DbColumn | undefined =
    db.columns.find((c) => c.id === db.dateBy && c.type === "date") ?? dateCols[0];
  const titleCol = db.columns.find((c) => c.type === "text");

  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });

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
    <div className="flex h-full flex-col">
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
              className={[
                "group min-h-[64px] border-b border-r border-neutral-100 p-1 text-xs",
                inMonth ? "bg-white" : "bg-neutral-50/60",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span
                  className={[
                    "px-1 tabular-nums",
                    isToday ? "rounded-full bg-blue-500 text-white" : inMonth ? "text-neutral-500" : "text-neutral-300",
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
                  <div key={r.id} className="truncate rounded bg-blue-50 px-1 py-0.5 text-[11px] text-blue-700">
                    {label(r)}
                  </div>
                ))}
                {rows.length > 3 && (
                  <div className="px-1 text-[10px] text-neutral-400">+{rows.length - 3} lagi</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
