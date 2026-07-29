import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPresentationOrder } from "./presentation";

const card = (id: string, x: number, y: number) => ({ id, x, y });
const link = (a: string, b: string) => ({ sourceElementId: a, targetElementId: b });

test("tanpa konektor: urut baca (atas→bawah, kiri→kanan)", () => {
  const order = buildPresentationOrder(
    [card("c", 0, 100), card("a", 0, 0), card("b", 50, 0)],
    []
  );
  assert.deepEqual(order, ["a", "b", "c"]);
});

test("ikuti arah konektor sebagai jalur cerita", () => {
  const order = buildPresentationOrder(
    [card("a", 0, 0), card("b", 0, 100), card("c", 0, 200)],
    [link("a", "b"), link("b", "c")]
  );
  assert.deepEqual(order, ["a", "b", "c"]);
});

test("mulai dari kartu tanpa panah masuk, walau posisinya paling bawah", () => {
  // "start" ada di bawah, tapi dialah satu-satunya tanpa panah masuk.
  const order = buildPresentationOrder(
    [card("mid", 0, 0), card("end", 0, 50), card("start", 0, 900)],
    [link("start", "mid"), link("mid", "end")]
  );
  assert.deepEqual(order, ["start", "mid", "end"]);
});

test("percabangan ditelusuri sesuai urutan posisi", () => {
  const order = buildPresentationOrder(
    [card("root", 0, 0), card("kanan", 100, 50), card("kiri", 0, 50)],
    [link("root", "kanan"), link("root", "kiri")]
  );
  assert.deepEqual(order, ["root", "kiri", "kanan"]);
});

test("siklus tetap selesai & tiap kartu muncul tepat sekali", () => {
  const order = buildPresentationOrder(
    [card("a", 0, 0), card("b", 0, 100)],
    [link("a", "b"), link("b", "a")]
  );
  assert.equal(order.length, 2);
  assert.deepEqual([...order].sort(), ["a", "b"]);
});

test("kartu terisolasi tetap ikut, disisipkan setelah jalur berkonektor", () => {
  const order = buildPresentationOrder(
    [card("a", 0, 0), card("b", 0, 100), card("lepas", 0, 200)],
    [link("a", "b")]
  );
  assert.deepEqual(order, ["a", "b", "lepas"]);
});

test("konektor ke kartu di papan lain diabaikan", () => {
  const order = buildPresentationOrder(
    [card("a", 0, 0), card("b", 0, 100)],
    [link("a", "b"), link("b", "papan-lain"), link("entah", "a")]
  );
  assert.deepEqual(order, ["a", "b"]);
});

test("papan kosong → urutan kosong", () => {
  assert.deepEqual(buildPresentationOrder([], []), []);
});
