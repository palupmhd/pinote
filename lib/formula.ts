import { daysFromToday } from "./dates";
import type { CellValue, DbColumn, DbRow, FormulaPreset } from "./types";

/** Label & jumlah input tiap preset — dipakai UI konfigurasi & compute. */
export const FORMULA_PRESETS: Record<FormulaPreset, { label: string; inputs: 1 | 2; hint: string }> = {
  days_until: { label: "Hari lagi", inputs: 1, hint: "berapa hari ke kolom Tanggal (negatif = lewat)" },
  date_status: { label: "Status tanggal", inputs: 1, hint: "“Lewat N hari” / “Hari ini” / “N hari lagi”" },
  sum: { label: "Jumlah (a + b)", inputs: 2, hint: "dua kolom angka" },
  diff: { label: "Selisih (a − b)", inputs: 2, hint: "dua kolom angka" },
  product: { label: "Kali (a × b)", inputs: 2, hint: "dua kolom angka" },
  percent: { label: "Persen (a ÷ b × 100)", inputs: 2, hint: "dua kolom angka" },
  concat: { label: "Gabung teks (a b)", inputs: 2, hint: "dua kolom apa saja" },
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Angka dari sel: number apa adanya, atau string numerik; selain itu null. */
function numOf(v: CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** String tampil dari sel untuk concat: teks/angka apa adanya; lainnya kosong. */
function dispOf(v: CellValue): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

/** Hitung nilai kolom formula untuk satu baris (spec §7.1). null = belum
 *  terkonfigurasi / tak bisa dihitung. Output number (days_until/hitung angka)
 *  atau string (date_status/concat). */
export function computeFormula(row: DbRow, col: DbColumn): string | number | null {
  const a = col.formulaColA;
  const b = col.formulaColB;
  switch (col.formulaPreset) {
    case "days_until": {
      if (!a) return null;
      const v = row.cells[a];
      return typeof v === "string" && ISO.test(v) ? daysFromToday(v) : null;
    }
    case "date_status": {
      if (!a) return null;
      const v = row.cells[a];
      if (typeof v !== "string" || !ISO.test(v)) return null;
      const d = daysFromToday(v);
      if (d === 0) return "Hari ini";
      return d < 0 ? `Lewat ${-d} hari` : `${d} hari lagi`;
    }
    case "sum":
    case "diff":
    case "product":
    case "percent": {
      const na = a ? numOf(row.cells[a]) : null;
      const nb = b ? numOf(row.cells[b]) : null;
      if (na == null || nb == null) return null;
      if (col.formulaPreset === "sum") return round2(na + nb);
      if (col.formulaPreset === "diff") return round2(na - nb);
      if (col.formulaPreset === "product") return round2(na * nb);
      return nb === 0 ? null : round2((na / nb) * 100); // percent
    }
    case "concat": {
      const s = [a ? dispOf(row.cells[a]) : "", b ? dispOf(row.cells[b]) : ""]
        .filter((x) => x !== "")
        .join(" ");
      return s === "" ? null : s;
    }
    default:
      return null;
  }
}
