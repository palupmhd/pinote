"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store";

/** Menu kecil di sebelah tombol "+ Database" untuk menempelkan kartu pintu
 *  baru ke database yang SUDAH ADA — ini yang membuat satu database bisa
 *  dipanggil di board mana pun (spec §7.3), bukan cuma dibuat ulang. */
export function DatabasePicker({ onAttach }: { onAttach: (databaseId: string) => void }) {
  const databases = useCanvasStore((s) => s.databases);
  const list = Object.values(databases);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [open]);

  if (list.length === 0) return null; // belum ada database untuk dipanggil ulang

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Panggil database yang sudah ada ke board ini"
        className="w-full rounded px-3 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        ↳ pakai yang ada…
      </button>

      {open && (
        <div className="absolute left-full top-0 z-20 ml-1 w-48 rounded-md bg-white p-1 shadow-lg ring-1 ring-neutral-200">
          {list.map((db) => (
            <button
              key={db.id}
              onClick={() => {
                onAttach(db.id);
                setOpen(false);
              }}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {db.title || "Database tanpa judul"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
