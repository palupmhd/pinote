import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClipboard } from "./clipboard";
import { useCanvasStore } from "./store";
import { CANVAS_MARGIN_X, CANVAS_MARGIN_Y, ROOT_BOARD_ID } from "./types";

function databaseIdOf(elementId: string): string {
  const el = useCanvasStore.getState().elements[elementId];
  assert.ok(el && el.type === "DATABASE_REF", "elemen harus kartu DATABASE_REF");
  return el.content.databaseId;
}

function createEmptyBoard(): string {
  const s = useCanvasStore.getState();
  const boardCardId = s.addBoard(CANVAS_MARGIN_X + 100, CANVAS_MARGIN_Y + 30);
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
  const noteId = s.addNote(CANVAS_MARGIN_X + 120, CANVAS_MARGIN_Y + 20);

  s.moveMany([{ id: noteId, x: CANVAS_MARGIN_X + 100, y: CANVAS_MARGIN_Y + 90 }]);

  const moved = useCanvasStore.getState().elements[noteId];
  assert.ok(moved && moved.type === "NOTE", "note harus masih ada");
  assert.equal(moved.x, CANVAS_MARGIN_X + 100);
  assert.equal(moved.y, CANVAS_MARGIN_Y + 90);
});

/** Regresi: moveMany dulu (versi "extend") memaksa kartu balik ke margin
 *  begitu posisinya melewati itu, DAN menggeser SELURUH kartu papan sejumlah
 *  yang sama — termasuk kartu lain yang sama sekali tak disentuh (dilaporkan
 *  pemilik: kartu "diam di tengah" ikut terlempar jauh gara-gara kartu LAIN
 *  ditarik ke pojok). Sekarang moveMany murni menulis posisi apa adanya,
 *  tanpa klem atau efek samping ke kartu lain — batas kiri/atas sepenuhnya
 *  jadi urusan kamera (lihat test setCamera di bawah). */
test("moveMany tidak lagi mengklem/menggeser posisi kartu — kartu bebas persis di mana ditaruh", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const untouchedId = s.addNote(0, 0); // "kartu di tengah", tak pernah disentuh sesudah ini
  const draggedId = s.addNote(0, 0);
  s.moveMany([
    { id: untouchedId, x: 1190, y: 910 },
    { id: draggedId, x: 1190, y: 910 },
  ]);

  s.moveMany([{ id: draggedId, x: -810, y: -810 }]); // jauh melewati sumbu 0

  const untouched = useCanvasStore.getState().elements[untouchedId];
  assert.ok(untouched && untouched.type === "NOTE", "note harus masih ada");
  assert.equal(untouched.x, 1190, "kartu yang tak disentuh tak boleh ikut bergeser");
  assert.equal(untouched.y, 910);

  const dragged = useCanvasStore.getState().elements[draggedId];
  assert.ok(dragged && dragged.type === "NOTE", "note harus masih ada");
  assert.equal(dragged.x, -810, "kartu yang digeser harus persis di posisi yang diberikan, tak diklem");
  assert.equal(dragged.y, -810);
});

/** Regresi: kiri/atas dulu batas KONSTAN dan ditegakkan dengan menggeser
 *  kartu (lihat test di atas). Sekarang batas murni urusan kamera, dan titik
 *  acuannya adalah dunia (0,0) — BUKAN `CANVAS_MARGIN_X`/`_Y` (itu cuma posisi
 *  garis smart-guide, lihat useElementDrag.ts): selama tak ada kartu yang
 *  menembus sumbu (x/y < 0), batas ISTIRAHAT persis di 0, apa pun posisi
 *  kartu di sisi positif (kartu jauh dari pojok bukan alasan mempersempit
 *  pan). Begitu ADA kartu yang sungguh negatif, batas melonggar ke posisi
 *  kartu itu MINUS margin sumbu itu (jarak nafas, beda kiri/atas). Begitu
 *  kartu itu ditarik balik ke sisi positif, batas kembali PERSIS ke 0 —
 *  bukan celah permanen, dan bukan pula "ikut mengetat ke kartu terdekat". */
test("setCamera: batas pan istirahat persis di 0, melonggar ke kartu−margin begitu menembus sumbu, balik ke 0 begitu kartu pergi", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const noteId = s.addNote(CANVAS_MARGIN_X + 300, CANVAS_MARGIN_Y + 300); // jauh dari pojok, tapi di sisi positif

  // Kartu jauh dari pojok (tapi tak menembus sumbu) bukan alasan mempersempit
  // pan — batas istirahat PERSIS di 0, bukan margin manapun.
  s.setCamera({ x: 0, y: 0, zoom: 1 }); // coba pan sampai pas ke sumbu
  assert.equal(useCanvasStore.getState().camera.x, 0, "batas default harus persis di 0, bukan CANVAS_MARGIN_X");
  assert.equal(useCanvasStore.getState().camera.y, 0, "batas default harus persis di 0, bukan CANVAS_MARGIN_Y");
  s.setCamera({ x: 50, y: 50, zoom: 1 }); // coba lewatin sumbu — harus mental balik ke 0
  assert.equal(useCanvasStore.getState().camera.x, 0, "tak boleh bisa pan melewati sumbu tanpa kartu yang menembusnya");
  assert.equal(useCanvasStore.getState().camera.y, 0);

  // Tarik kartu itu jauh MELEWATI sumbu — kartu sendiri tak diklem (lihat
  // test moveMany di atas), tapi batas pan harus melonggar tepat sejauh
  // posisi kartu itu dikurangi margin sumbu masing-masing.
  s.moveMany([{ id: noteId, x: -500, y: -500 }]);
  s.setCamera({ x: 500 + CANVAS_MARGIN_X, y: 500 + CANVAS_MARGIN_Y, zoom: 1 }); // pas di batas baru
  const extended = useCanvasStore.getState().camera;
  assert.equal(extended.x, 500 + CANVAS_MARGIN_X, "batas X harus pas di kartu−CANVAS_MARGIN_X");
  assert.equal(extended.y, 500 + CANVAS_MARGIN_Y, "batas Y harus pas di kartu−CANVAS_MARGIN_Y");
  s.setCamera({ x: 500 + CANVAS_MARGIN_X + 1, y: 500 + CANVAS_MARGIN_Y + 1, zoom: 1 }); // 1px lebih jauh
  const overshoot = useCanvasStore.getState().camera;
  assert.equal(overshoot.x, 500 + CANVAS_MARGIN_X, "tak boleh bisa pan lebih jauh dari jarak nafas itu");
  assert.equal(overshoot.y, 500 + CANVAS_MARGIN_Y);

  // Tarik kartu itu balik ke sisi positif (tak lagi menembus sumbu) — batas
  // harus kembali PERSIS ke 0, bukan mengetat mengikuti posisi barunya.
  s.moveMany([{ id: noteId, x: CANVAS_MARGIN_X + 300, y: CANVAS_MARGIN_Y + 300 }]);
  s.setCamera({ x: 0, y: 0, zoom: 1 });
  const reverted = useCanvasStore.getState().camera;
  assert.equal(reverted.x, 0, "batas harus kembali persis ke 0, bukan mengetat ke posisi kartu");
  assert.equal(reverted.y, 0);
});

// --- Kartu DATABASE_VIEW (extract Kanban/Kalender/Tabel jadi kartu kanvas) ---

test("attachDatabaseView menghasilkan elemen DATABASE_VIEW berbentuk benar", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const doorId = s.addDatabase(0, 0);
  const dbId = databaseIdOf(doorId);

  const viewElId = s.attachDatabaseView(dbId, "kanban", 200, 200);
  assert.ok(viewElId, "attachDatabaseView harus berhasil untuk database yang ada");

  const el = useCanvasStore.getState().elements[viewElId!];
  assert.ok(el && el.type === "DATABASE_VIEW", "elemen harus bertipe DATABASE_VIEW");
  assert.equal(el.content.databaseId, dbId);
  assert.equal(el.content.view, "kanban");

  // Database yang tak ada → gagal (null), tak bikin elemen apa pun.
  assert.equal(s.attachDatabaseView("id-tak-ada", "kanban", 0, 0), null);
});

test("setDatabaseViewConfig: dua kartu-view dari database sama tetap independen, Database.groupBy shared tak ikut berubah", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const doorId = s.addDatabase(0, 0);
  const dbId = databaseIdOf(doorId);
  const groupByBefore = useCanvasStore.getState().databases[dbId]!.groupBy;

  const cardAId = s.attachDatabaseView(dbId, "kanban", 100, 100)!;
  const cardBId = s.attachDatabaseView(dbId, "kanban", 300, 100)!;

  s.setDatabaseViewConfig(cardAId, { groupBy: "col-status" });
  s.setDatabaseViewConfig(cardBId, { groupBy: "col-priority" });

  const after = useCanvasStore.getState();
  const cardA = after.elements[cardAId];
  const cardB = after.elements[cardBId];
  assert.ok(cardA && cardA.type === "DATABASE_VIEW");
  assert.ok(cardB && cardB.type === "DATABASE_VIEW");
  assert.equal(cardA.content.groupBy, "col-status");
  assert.equal(cardB.content.groupBy, "col-priority", "kartu B tak boleh ikut ketiban groupBy kartu A");
  assert.equal(after.databases[dbId]!.groupBy, groupByBefore, "Database.groupBy shared tak boleh ikut berubah");
});

test("hapus kartu DATABASE_REF/DATABASE_VIEW: database cuma benar-benar hilang begitu SEMUA kartu penunjuknya hilang", () => {
  createEmptyBoard();
  const s = useCanvasStore.getState();
  const doorId = s.addDatabase(0, 0);
  const dbId = databaseIdOf(doorId);
  const viewAId = s.attachDatabaseView(dbId, "kanban", 100, 100)!;
  const viewBId = s.attachDatabaseView(dbId, "calendar", 300, 100)!;

  // Hapus salah satu kartu-view → door-card + kartu-view lain masih menunjuk
  // database ini → database TIDAK boleh hilang.
  s.removeElement(viewAId);
  assert.ok(useCanvasStore.getState().databases[dbId], "database harus tetap ada (2 kartu lain masih menunjuk)");

  // Hapus door-card → masih ada 1 kartu-view → database TETAP tidak boleh hilang.
  s.removeElement(doorId);
  assert.ok(useCanvasStore.getState().databases[dbId], "database harus tetap ada (1 kartu-view masih menunjuk)");

  // Hapus kartu-view TERAKHIR → tak ada lagi yang menunjuk → database harus
  // benar-benar hilang, bukan jadi hantu.
  s.removeElement(viewBId);
  assert.equal(useCanvasStore.getState().databases[dbId], undefined, "database harus hilang setelah referensi terakhir dihapus");
});

test("pasteElements meremap content.databaseId pada DATABASE_VIEW ke database hasil clone", () => {
  const boardId = createEmptyBoard();
  const s = useCanvasStore.getState();
  const doorId = s.addDatabase(0, 0);
  const dbId = databaseIdOf(doorId);
  const viewId = s.attachDatabaseView(dbId, "kanban", 100, 100, { groupBy: "col-x" })!;

  const payload = buildClipboard(useCanvasStore.getState(), [viewId]);
  const [pastedId] = s.pasteElements(payload, boardId, { x: 24, y: 24 });

  const pasted = useCanvasStore.getState().elements[pastedId];
  assert.ok(pasted && pasted.type === "DATABASE_VIEW", "hasil paste harus DATABASE_VIEW");
  assert.notEqual(pasted.content.databaseId, dbId, "harus menunjuk database HASIL CLONE, bukan yang asli");
  assert.ok(useCanvasStore.getState().databases[pasted.content.databaseId], "database hasil clone harus ada di store");
  assert.equal(pasted.content.view, "kanban", "view/groupBy lain harus ikut ter-clone apa adanya");
  assert.equal(pasted.content.groupBy, "col-x");
});
