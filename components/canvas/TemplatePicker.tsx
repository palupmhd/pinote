"use client";

import { useEffect, useRef, useState } from "react";
import { BOARD_TEMPLATES, type BoardTemplate } from "@/lib/templates";

/** Menu kecil di bawah tombol "+ Papan": buat papan baru dari template siap-pakai
 *  (spec v1.1 template starter). */
export function TemplatePicker({ onPick }: { onPick: (t: BoardTemplate) => void }) {
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

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Buat papan dari template siap-pakai"
        className="w-full rounded px-3 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        ↳ dari template…
      </button>

      {open && (
        <div className="absolute left-full top-0 z-20 ml-1 w-56 rounded-md bg-white p-1 shadow-lg ring-1 ring-neutral-200">
          {BOARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onPick(t);
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100"
            >
              <span className="block text-sm text-neutral-800">{t.name}</span>
              <span className="block text-xs text-neutral-400">{t.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
