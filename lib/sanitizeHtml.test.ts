import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeUrl } from "./sanitizeHtml";

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/** REGRESI: penjaga lama memakai denylist `startsWith("javascript:")` setelah
 *  `.trim()`. Browser MENGABAIKAN tab/LF/CR di mana pun dalam URL saat membaca
 *  skema, jadi `java<TAB>script:` lolos pengecekan tapi tetap dieksekusi sebagai
 *  javascript: — terbukti bisa dieksploitasi lewat DOM sungguhan sebelum
 *  diperbaiki jadi allowlist. */
test("tolak javascript: yang disamarkan karakter kontrol", () => {
  assert.ok(!isSafeUrl("java" + TAB + "script:alert(1)"));
  assert.ok(!isSafeUrl("java" + LF + "script:alert(1)"));
  assert.ok(!isSafeUrl("java" + CR + "script:alert(1)"));
  assert.ok(!isSafeUrl("  javascript:alert(1)"));
  assert.ok(!isSafeUrl("java" + TAB + LF + CR + "script:alert(1)"));
});

test("tolak skema yang bisa mengeksekusi, apa pun kapitalisasinya", () => {
  assert.ok(!isSafeUrl("javascript:alert(1)"));
  assert.ok(!isSafeUrl("JaVaScRiPt:alert(1)"));
  assert.ok(!isSafeUrl("data:text/html,PHNjcmlwdD4="));
  assert.ok(!isSafeUrl("vbscript:msgbox(1)"));
});

test("tolak skema tak dikenal (allowlist, bukan denylist)", () => {
  assert.ok(!isSafeUrl("file:///etc/passwd"));
  assert.ok(!isSafeUrl("blob:https://x/y"));
  assert.ok(!isSafeUrl("ftp://x/y"));
});

test("izinkan skema yang memang dipakai app", () => {
  assert.ok(isSafeUrl("https://example.com/a?b=c#d"));
  assert.ok(isSafeUrl("http://example.com/"));
  assert.ok(isSafeUrl("mailto:a@b.c"));
  assert.ok(isSafeUrl("board:2f1c-abc"), "mention papan internal (spec §9.3)");
});

test("izinkan URL relatif (tanpa skema — tak bisa mengeksekusi)", () => {
  assert.ok(isSafeUrl("/foo/bar"));
  assert.ok(isSafeUrl("foo.html"));
  assert.ok(isSafeUrl("#anchor"));
  assert.ok(isSafeUrl("?q=1"));
});
