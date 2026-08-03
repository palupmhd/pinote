"use client";

import { useEffect, useRef, useState } from "react";
import type { DatabaseView } from "@/lib/types";

const VIEWS: { value: DatabaseView; label: string }[] = [
  { value: "table", label: "Tabel" },
  { value: "kanban", label: "Kanban" },
  { value: "calendar", label: "Kalender" },
  { value: "gallery", label: "Galeri" },
  { value: "spatial", label: "Spasial" },
];

/** Ikon hover-visible di pojok kartu pintu (DatabaseCard) — pilih satu
 *  tampilan untuk dikeluarkan langsung sebagai kartu DATABASE_VIEW di
 *  kanvas, tanpa perlu buka modal dulu. Salinan shell DatabasePicker.tsx
 *  (toggle button → panel absolute → klik-luar menutup), bukan context menu:
 *  tak ada pola context-menu di app ini, dan ikon hover-visible lebih
 *  konsisten dengan handle lain (ConnectHandle/ResizeHandle) yang sudah
 *  dipakai kartu manapun. */
export function DatabaseViewPicker({ onPick }: { onPick: (view: DatabaseView) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="absolute -left-2 -top-2 z-10">
      <button
        onPointerDown={(e) => e.stopPropagation()} // jangan ikut men-drag kartunya
        onClick={() => setOpen((v) => !v)}
        title="Keluarkan salah satu tampilan sebagai kartu baru"
        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-forest-400 text-[11px] text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
      >
        ▦
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-md bg-white p-1 shadow-lg ring-1 ring-neutral-200">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => {
                onPick(v.value);
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
