import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRollup } from "./rollup";
import type { Database, DbRow } from "./types";

/** Dua database: "src" punya kolom relasi ke "dst"; "dst" punya kolom angka. */
function fixture(links: string[], dstRows: DbRow[] = []) {
  const dst: Database = {
    id: "dst",
    title: "Tujuan",
    columns: [{ id: "n", name: "Nilai", type: "number" }],
    rows: dstRows,
  };
  const src: Database = {
    id: "src",
    title: "Sumber",
    columns: [
      { id: "rel", name: "Tautan", type: "relation", targetDatabaseId: "dst" },
      { id: "ru", name: "Rollup", type: "rollup" },
    ],
    rows: [{ id: "r1", cells: { rel: links } }],
  };
  return { src, dst, row: src.rows[0], databases: { src, dst } };
}

const dstRow = (id: string, n: number | null): DbRow => ({ id, cells: n === null ? {} : { n } });

test("count: hanya menghitung tautan yang barisnya masih ada", () => {
  const f = fixture(["a", "b", "hantu"], [dstRow("a", 1), dstRow("b", 2)]);
  const col = { id: "ru", name: "R", type: "rollup" as const, rollupRelationId: "rel", rollupOp: "count" as const };
  assert.equal(computeRollup(f.src, f.row, col, f.databases), 2);
});

test("sum / avg / min / max atas kolom angka tujuan", () => {
  const f = fixture(["a", "b", "c"], [dstRow("a", 10), dstRow("b", 4), dstRow("c", 7)]);
  const col = (op: "sum" | "avg" | "min" | "max") => ({
    id: "ru", name: "R", type: "rollup" as const,
    rollupRelationId: "rel", rollupOp: op, rollupTargetColumnId: "n",
  });
  assert.equal(computeRollup(f.src, f.row, col("sum"), f.databases), 21);
  assert.equal(computeRollup(f.src, f.row, col("avg"), f.databases), 7);
  assert.equal(computeRollup(f.src, f.row, col("min"), f.databases), 4);
  assert.equal(computeRollup(f.src, f.row, col("max"), f.databases), 10);
});

test("avg dibulatkan 2 desimal", () => {
  const f = fixture(["a", "b", "c"], [dstRow("a", 1), dstRow("b", 1), dstRow("c", 2)]);
  const col = {
    id: "ru", name: "R", type: "rollup" as const,
    rollupRelationId: "rel", rollupOp: "avg" as const, rollupTargetColumnId: "n",
  };
  assert.equal(computeRollup(f.src, f.row, col, f.databases), 1.33);
});

test("tanpa nilai: sum = 0, tapi avg/min/max kosong (bukan 0 yang mengada-ada)", () => {
  const f = fixture([], []);
  const col = (op: "sum" | "avg" | "min" | "max") => ({
    id: "ru", name: "R", type: "rollup" as const,
    rollupRelationId: "rel", rollupOp: op, rollupTargetColumnId: "n",
  });
  assert.equal(computeRollup(f.src, f.row, col("sum"), f.databases), 0);
  assert.equal(computeRollup(f.src, f.row, col("avg"), f.databases), null);
  assert.equal(computeRollup(f.src, f.row, col("min"), f.databases), null);
  assert.equal(computeRollup(f.src, f.row, col("max"), f.databases), null);
});

test("sel kosong di baris tujuan dilewati, bukan dihitung 0", () => {
  const f = fixture(["a", "b"], [dstRow("a", 6), dstRow("b", null)]);
  const col = {
    id: "ru", name: "R", type: "rollup" as const,
    rollupRelationId: "rel", rollupOp: "avg" as const, rollupTargetColumnId: "n",
  };
  assert.equal(computeRollup(f.src, f.row, col, f.databases), 6);
});

test("belum dikonfigurasi → null", () => {
  const f = fixture(["a"], [dstRow("a", 1)]);
  const noRel = { id: "ru", name: "R", type: "rollup" as const, rollupOp: "sum" as const };
  assert.equal(computeRollup(f.src, f.row, noRel, f.databases), null);
  const noTargetCol = { id: "ru", name: "R", type: "rollup" as const, rollupRelationId: "rel", rollupOp: "sum" as const };
  assert.equal(computeRollup(f.src, f.row, noTargetCol, f.databases), null);
});
