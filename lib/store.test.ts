import { test } from "node:test";
import assert from "node:assert/strict";
import { useCanvasStore } from "./store";
import { CANVAS_MARGIN, ROOT_BOARD_ID } from "./types";

function databaseIdOf(elementId: string): string {
  const el = useCanvasStore.getState().elements[elementId];
  assert.ok(el && el.type === "DATABASE_REF", "elemen harus kartu DATABASE_REF");
  return el.content.databaseId;
}

function createEmptyBoard(): string {
  const s = useCanvasStore.getState();
  const boardCardId = s.addBoard(CANVAS_MARGIN + 100, CANVAS_MARGIN + 30);
  const boardCard = useCanvasStore.getState().elements[boardCardId];
  assert.ok(boardCard && boardCard.type === "BOARD_REF", "addBoard harus membuat BOARD_REF");
  s.openBoard(boardCard.content.boardId);
  return boardCard.content.boardId;
}

/** Regresi: removeRow dulu punya kaskade "dangkal" untuk baris yang punya
 *  kanvas bertaut (dibuka via "buka baris sebagai kanvas") — board +
 *  elemennya dihapus, tapi database di DALAM board itu (kartu DATABASE_REF)
 *  tidak ikut dibuang, jadi jadi database hantu: tetap nyangkut di store
 *  selamanya, tak tersambung kartu mana pun, tapi tetap muncul di
 *  DatabasePicker ("↳ pakai yang ada…"). Sekarang removeRow pakai
 *  purgeBoardCascade yang sama dengan penghapusan kartu BOARD_REF. */
test("removeRow membuang database yatim di dalam board bertaut (bukan cuma board+elemennya)", () => {
  const s = useCanvasStore.getState();

  const outerElId = s.addDatabase(0, 0);
  const outerDbId = databaseIdOf(outerElId);
  s.addRow(outerDbId);
  const rowId = useCanvasStore.getState().databases[outerDbId]!.rows[0]!.id;

  const boardId = s.openRowAsBoard(outerDbId, rowId);
  assert.ok(boardId, "board bertaut harus terbuat");
  assert.equal(useCanvasStore.getState().currentBoardId, boardId);

  const innerElId = s.addDatabase(0, 0);
  const innerDbId = databaseIdOf(innerElId);
  assert.ok(useCanvasStore.getState().databases[innerDbId], "database dalam harus ada sebelum dihapus");

  s.openBoard(ROOT_BOARD_ID);
  s.removeRow(outerDbId, rowId);

  const after = useCanvasStore.getState();
  assert.equal(after.boards[boardId!], undefined, "board bertaut harus ikut terhapus");
  assert.equal(after.elements[innerElId], undefined, "kartu database dalam harus ikut terhapus");
  assert.equal(after.databases[innerDbId], undefined, "database dalam harus ikut terhapus (bukan jadi hantu)");
});

test("moveMany tidak menjadikan kartu paling kiri/atas sebagai batas layar", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const noteId = s.addNote(CANVAS_MARGIN + 120, CANVAS_MARGIN + 20);

  s.moveMany([{ id: noteId, x: CANVAS_MARGIN + 100, y: CANVAS_MARGIN + 90 }]);

  const moved = useCanvasStore.getState().elements[noteId];
  assert.ok(moved && moved.type === "NOTE", "note harus masih ada");
  assert.equal(moved.x, CANVAS_MARGIN + 100);
  assert.equal(moved.y, CANVAS_MARGIN + 90);
});

test("moveMany tetap mencegah kartu melewati batas kiri/atas dunia", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const noteId = s.addNote(CANVAS_MARGIN + 220, CANVAS_MARGIN + 120);

  s.moveMany([{ id: noteId, x: 0, y: 0 }]);

  const moved = useCanvasStore.getState().elements[noteId];
  assert.ok(moved && moved.type === "NOTE", "note harus masih ada");
  assert.equal(moved.x, CANVAS_MARGIN);
  assert.equal(moved.y, CANVAS_MARGIN);
});
