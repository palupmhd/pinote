"use client";

import type { ColumnType } from "@/lib/types";
import {
  IconColCheckbox,
  IconColDate,
  IconColFormula,
  IconColNumber,
  IconColRelation,
  IconColRollup,
  IconColText,
} from "./icons";

/** Label & ikon per tipe kolom — satu sumber kebenaran dipakai header kolom
 *  (ikon kolaps), pemilih tipe saat tambah kolom, dan popover ubah tipe.
 *  Sebagai Record atas ColumnType, tipe baru di union itu langsung jadi galat
 *  kompilasi di sini kalau lupa dikasih label/ikon. */
export const COLUMN_TYPE_LABEL: Record<ColumnType, string> = {
  text: "Teks",
  number: "Angka",
  checkbox: "Centang",
  date: "Tanggal",
  relation: "Relasi",
  rollup: "Rollup",
  formula: "Formula",
};

export const COLUMN_TYPE_ICON: Record<ColumnType, (p: { className?: string }) => React.ReactNode> = {
  text: IconColText,
  number: IconColNumber,
  checkbox: IconColCheckbox,
  date: IconColDate,
  relation: IconColRelation,
  rollup: IconColRollup,
  formula: IconColFormula,
};

/** Daftar tipe kolom (ikon + label), dipakai popover "tambah kolom" (pilih
 *  tipe untuk kolom baru) DAN popover "ubah kolom" (ganti tipe kolom yang
 *  sudah ada — `value` menyorot tipe yang aktif sekarang). Gaya Notion: nama
 *  dulu (di luar komponen ini, lewat input terpisah), lalu pilih tipe dari
 *  daftar berlabel — bukan dropdown teks polos tanpa ikon. */
export function ColumnTypeGrid({
  value,
  onPick,
}: {
  value?: ColumnType;
  onPick: (type: ColumnType) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {(Object.keys(COLUMN_TYPE_LABEL) as ColumnType[]).map((t) => {
        const Icon = COLUMN_TYPE_ICON[t];
        return (
          <button
            key={t}
            onClick={() => onPick(t)}
            className={[
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
              value === t ? "bg-forest-50 text-forest-800" : "text-neutral-700 hover:bg-neutral-100",
            ].join(" ")}
          >
            <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
            {COLUMN_TYPE_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}
