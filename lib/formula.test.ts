import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFormula } from "./formula";
import type { DbColumn, DbRow } from "./types";

const col = (over: Partial<DbColumn>): DbColumn => ({
  id: "f",
  name: "F",
  type: "formula",
  ...over,
});
const row = (cells: DbRow["cells"]): DbRow => ({ id: "r", cells });

/** Tanggal relatif hari ini, "YYYY-MM-DD" lokal — supaya tes tak basi besok. */
function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test("days_until: depan, hari ini, lewat", () => {
  const c = col({ formulaPreset: "days_until", formulaColA: "d" });
  assert.equal(computeFormula(row({ d: inDays(5) }), c), 5);
  assert.equal(computeFormula(row({ d: inDays(0) }), c), 0);
  assert.equal(computeFormula(row({ d: inDays(-3) }), c), -3);
});

test("date_status: kalimat per kondisi", () => {
  const c = col({ formulaPreset: "date_status", formulaColA: "d" });
  assert.equal(computeFormula(row({ d: inDays(0) }), c), "Hari ini");
  assert.equal(computeFormula(row({ d: inDays(2) }), c), "2 hari lagi");
  assert.equal(computeFormula(row({ d: inDays(-4) }), c), "Lewat 4 hari");
});

test("aritmetika dua kolom", () => {
  const c = (p: DbColumn["formulaPreset"]) =>
    col({ formulaPreset: p, formulaColA: "a", formulaColB: "b" });
  const r = row({ a: 10, b: 4 });
  assert.equal(computeFormula(r, c("sum")), 14);
  assert.equal(computeFormula(r, c("diff")), 6);
  assert.equal(computeFormula(r, c("product")), 40);
  assert.equal(computeFormula(r, c("percent")), 250);
});

test("percent: pembagi nol → kosong, bukan Infinity", () => {
  const c = col({ formulaPreset: "percent", formulaColA: "a", formulaColB: "b" });
  assert.equal(computeFormula(row({ a: 5, b: 0 }), c), null);
});

test("hasil dibulatkan 2 desimal", () => {
  const c = col({ formulaPreset: "percent", formulaColA: "a", formulaColB: "b" });
  assert.equal(computeFormula(row({ a: 1, b: 3 }), c), 33.33);
});

test("concat: gabung, lewati yang kosong", () => {
  const c = col({ formulaPreset: "concat", formulaColA: "a", formulaColB: "b" });
  assert.equal(computeFormula(row({ a: "Hi", b: 3 }), c), "Hi 3");
  assert.equal(computeFormula(row({ a: "Hi" }), c), "Hi");
  assert.equal(computeFormula(row({}), c), null);
});

test("input hilang / tipe salah / belum dikonfigurasi → null (bukan NaN)", () => {
  assert.equal(computeFormula(row({ a: 1 }), col({ formulaPreset: "sum", formulaColA: "a" })), null);
  assert.equal(
    computeFormula(row({ a: "bukan angka", b: 2 }), col({ formulaPreset: "sum", formulaColA: "a", formulaColB: "b" })),
    null
  );
  assert.equal(computeFormula(row({ d: "bukan tanggal" }), col({ formulaPreset: "days_until", formulaColA: "d" })), null);
  assert.equal(computeFormula(row({ a: 1 }), col({})), null, "preset belum dipilih");
});

test("angka dalam bentuk string tetap dihitung", () => {
  const c = col({ formulaPreset: "sum", formulaColA: "a", formulaColB: "b" });
  assert.equal(computeFormula(row({ a: "10", b: 5 }), c), 15);
});
