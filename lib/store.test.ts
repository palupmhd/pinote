import { test } from "node:test";
import assert from "node:assert/strict";
import { useCanvasStore } from "./store";
import { ROOT_BOARD_ID } from "./types";

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
  const outerDbId = useCanvasStore.getState().elements[outerElId]!.content.databaseId as string;
  s.addRow(outerDbId);
  const rowId = useCanvasStore.getState().databases[outerDbId]!.rows[0]!.id;

  const boardId = s.openRowAsBoard(outerDbId, rowId);
  assert.ok(boardId, "board bertaut harus terbuat");
  assert.equal(useCanvasStore.getState().currentBoardId, boardId);

  const innerElId = s.addDatabase(0, 0);
  const innerDbId = useCanvasStore.getState().elements[innerElId]!.content.databaseId as string;
  assert.ok(useCanvasStore.getState().databases[innerDbId], "database dalam harus ada sebelum dihapus");

  s.openBoard(ROOT_BOARD_ID);
  s.removeRow(outerDbId, rowId);

  const after = useCanvasStore.getState();
  assert.equal(after.boards[boardId!], undefined, "board bertaut harus ikut terhapus");
  assert.equal(after.elements[innerElId], undefined, "kartu database dalam harus ikut terhapus");
  assert.equal(after.databases[innerDbId], undefined, "database dalam harus ikut terhapus (bukan jadi hantu)");
});
