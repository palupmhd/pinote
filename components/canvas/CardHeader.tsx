"use client";

import type { ReactNode } from "react";

/** Header ikon+LABEL seragam di atas tiap kartu (gaya mockup: "TASKS",
 *  "MOODBOARD"…) — penanda tipe kartu yang cepat dipindai saat papan penuh
 *  elemen campuran. Baca-saja & dekoratif; aksi kartu tetap di CardActionBar. */
export function CardHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
      <span className="text-neutral-400">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
