import type { Database, DbColumn, DbRow } from "./types";

/** Hitung nilai kolom rollup untuk satu baris (spec §7.1). null = belum
 *  terkonfigurasi / tak bisa dihitung; angka = hasil. count = jumlah baris
 *  tertaut lewat kolom relasi; sum/avg/min/max = agregasi atas kolom angka di
 *  database tujuan relasi. */
export function computeRollup(
  db: Database,
  row: DbRow,
  col: DbColumn,
  databases: Record<string, Database>
): number | null {
  const relCol = db.columns.find((c) => c.id === col.rollupRelationId && c.type === "relation");
  if (!relCol) return null;

  const links = Array.isArray(row.cells[relCol.id]) ? (row.cells[relCol.id] as string[]) : [];
  const op = col.rollupOp ?? "count";
  if (op === "count") return links.length;

  const targetDb = relCol.targetDatabaseId ? databases[relCol.targetDatabaseId] : undefined;
  const targetColId = col.rollupTargetColumnId;
  if (!targetDb || !targetColId) return null;

  const nums = links
    .map((id) => targetDb.rows.find((r) => r.id === id))
    .filter((r): r is DbRow => !!r)
    .map((r) => r.cells[targetColId])
    .filter((v): v is number => typeof v === "number");

  if (nums.length === 0) return 0;
  switch (op) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    default:
      return null;
  }
}
