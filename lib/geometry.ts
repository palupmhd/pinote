import { CANVAS_MARGIN_X, CANVAS_MARGIN_Y, CARD_GUTTER, GRID } from "./types";
import type { BoardElement, Box, Camera } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Bulatkan ke kelipatan `step` terdekat (default GRID) — satu fungsi dipakai
 *  drag (posisi, selalu kelipatan GRID penuh) DAN resize (lebar/tinggi, bisa
 *  diminta kelipatan GRID/2 supaya ikut menempel ke dot minor di tengah grid
 *  mayor — lihat pemanggilan di ResizeHandle.tsx). */
export const snapToGrid = (v: number, step: number = GRID): number => Math.round(v / step) * step;

// Jangkauan smart-guide (gaya Figma) di sekitar margin kanvas MAUPUN tepi
// SEJENIS kartu lain (kiri-kiri, tengah-tengah, dst — buat rata baris/
// kolom), dalam PIKSEL LAYAR tetap (dibagi zoom di titik pemakaian) — supaya
// "kelengketannya" terasa sama di zoom berapa pun. Dipakai drag posisi
// (useElementDrag.ts) DAN resize (ResizeHandle.tsx).
export const SNAP_ZONE_PX = 8;

// Jangkauan smart-guide KHUSUS pasangan "nempel" (tepi berlawanan, target
// CARD_ADJACENT_GAP=5px — lihat cardAlignPairs) — SENGAJA lebih SEMPIT dari
// SNAP_ZONE_PX. Dilaporkan pemilik: pakai zona 8px yang sama bikin susah
// sengaja naruh jarak 10px (atau kelipatan 5 lain) ke kartu tetangga —
// 10px cuma beda 5px dari target snap 5px, jelas di DALAM zona 8px, jadi
// "ketarik" ke 5px tiap kali walau maksudnya 10. Zona sempit ini (lebih
// kecil dari jarak GRID/2=5px antar nilai celah yang valid) memastikan
// snap-ke-5 cuma aktif kalau BENAR-benar dekat 5px, tak lagi "mencuri"
// upaya menuju nilai kelipatan grid lain di sekitarnya — nilai lain tetap
// kena bulat ke kelipatan 5 terdekat lewat grid-snap biasa saat dilepas
// (independen dari smart-guide ini), jadi tak kehilangan presisi.
export const ADJACENT_SNAP_ZONE_PX = 3;

/** Batas pan kiri/atas yang SUNGGUH berlaku sekarang. Titik acuan mutlak
 *  adalah dunia (0,0) — itu TAK PERNAH bergeser. Selama tak ada kartu yang
 *  "menembus sumbu" (posisinya < 0), batas pan ISTIRAHAT persis di 0 — kartu
 *  yang kebetulan jauh dari pojok (mis. di tengah papan, x=500) TIDAK bikin
 *  pan lebih sempit dari itu, itu bukan "extend", cuma kartu biasa.
 *
 *  Begitu ADA kartu yang x/y-nya sungguh negatif (menembus sumbu), batas
 *  melonggar ke posisi kartu terluar itu MINUS `CANVAS_MARGIN_X`/`_Y` — kasih
 *  jarak nafas yang sama besarnya dengan garis reminder (lihat
 *  `useElementDrag`) di luar kartu itu, supaya pan tak berhenti pas mepet di
 *  tepinya. Begitu kartu itu tak ada lagi di sana (ditarik balik ke sisi
 *  positif, atau dihapus), batas kembali PERSIS ke 0 — bukan celah permanen,
 *  bukan pula ikut mengetat ke kartu mana pun yang masih di sisi positif.
 *
 *  Kartu TIDAK pernah digeser paksa buat menegakkan ini (lihat komentar
 *  `moveMany` di store.ts — versi lama begitu, dan itu bug: kartu LAIN yang
 *  sama sekali tak disentuh ikut terlempar tiap kali ada kartu ditarik
 *  melewati margin). Fungsi ini murni PEMBACAAN posisi kartu apa adanya. */
export function boardMinCorner(elements: Record<string, BoardElement>, boardId: string): Point {
  let minX = Infinity;
  let minY = Infinity;
  for (const el of Object.values(elements)) {
    if (el.boardId !== boardId || el.type === "CONNECTOR") continue;
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
  }
  return {
    x: Number.isFinite(minX) && minX < 0 ? minX - CANVAS_MARGIN_X : 0,
    y: Number.isFinite(minY) && minY < 0 ? minY - CANVAS_MARGIN_Y : 0,
  };
}

/** Kiri/atas kanvas adalah tepi keras: dunia di bawah `boundary` (world x/y,
 *  lihat `boardMinCorner`) tak pernah boleh kelihatan (gaya "halaman"
 *  Milanote, bukan bidang tak-berhingga ke segala arah).
 *  Pada zoom berapa pun, titik dunia `boundary` ada di layar pada posisi
 *  `camera.{x,y} + boundary.{x,y}*zoom` — jadi supaya sisi kiri/atas
 *  viewport tak pernah menunjukkan koordinat di bawah batas itu,
 *  `camera.x`/`camera.y` tak boleh lebih dari `-boundary.{x,y}*zoom`.
 *  Kanan/bawah tetap tak terbatas (biarkan tumbuh mengikuti kartu). */
export function clampCamera(cam: Camera, boundary: Point = { x: 0, y: 0 }): Camera {
  // `|| 0` menormalkan -0 (muncul begitu boundary tepat 0 — `-0 * zoom`
  // tetap -0 di JS) balik ke 0 polos; keduanya berperilaku identik secara
  // numerik/visual, ini murni kosmetik biar nilai kamera tak pernah -0.
  const limitX = -boundary.x * cam.zoom || 0;
  const limitY = -boundary.y * cam.zoom || 0;
  return { ...cam, x: Math.min(cam.x, limitX), y: Math.min(cam.y, limitY) };
}

export const boxCenter = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Kotak yang SUNGGUH terlihat (permukaan bermargin) dari sebuah kartu, bukan
 *  kotak posisi mentahnya (yang sejak fix gutter-grid sengaja lebih besar
 *  `2×CARD_GUTTER` dari elemen — lihat CARD_GUTTER di lib/types.ts). Dipakai
 *  di mana pun garis/titik konektor atau kamera perlu menunjuk ke tepi kartu
 *  yang pengguna benar-benar lihat, bukan kotak posisi yang tak kasat mata.
 *
 *  `w` dari elemen (sudah otomatis pas dengan lebar permukaan — lihat
 *  komentar di NoteCard dkk). `h` diukur dari tinggi OUTER yang dirender
 *  (elemen tak punya field tinggi tetap saat auto-height), dikurangi
 *  2×CARD_GUTTER supaya jadi tinggi permukaan yang sungguh terlihat. */
export function cardVisualBox(
  el: { x: number; y: number; width: number },
  outerNode: HTMLElement | null,
  fallbackVisualHeight: number
): Box {
  const h = outerNode ? outerNode.offsetHeight - CARD_GUTTER * 2 : fallbackVisualHeight;
  return { x: el.x + CARD_GUTTER, y: el.y + CARD_GUTTER, w: el.width, h };
}

/** Jarak nafas dunia saat DUA kartu "nempel" (tepi BERLAWANAN saling
 *  mendekat, mis. kanan kartu A ke kiri kartu B — beda dari tepi SEJENIS
 *  yang mau rata baris/kolom) — dot minor (GRID/2), biar konsisten sama
 *  ritme grid yang sudah ada. Dipakai `cardAlignPairs`; permintaan pemilik
 *  supaya dua kartu yang "nempel" via smart-guide selalu punya jarak nafas
 *  kecil, bukan bener-bener 0px rapat. */
export const CARD_ADJACENT_GAP = GRID / 2;

/** Satu garis smart-guide aktif (dunia, bukan layar — Canvas.tsx yang
 *  menerjemahkan lewat kamera). `bounded=false` = garis margin kanvas (tetap
 *  penuh selayar, dipakai drag posisi saja); `bounded=true` = garis nempel-
 *  ke-kartu-lain (cuma sepanjang rentang dua kotak yang align, gaya Figma —
 *  perlu `worldStart`/`worldEnd`; dipakai drag posisi MAUPUN resize). */
export interface GuideLine {
  worldPos: number;
  bounded: boolean;
  worldStart?: number;
  worldEnd?: number;
}

/** Satu pasangan kandidat↔sasaran smart-guide pada satu sumbu — posisi
 *  SEKARANG dari sisi yang bergerak (`candidateValue`) lawan posisi yang
 *  dituju kalau match (`targetValue`). `other` = kotak kartu sumber sasaran
 *  ini (undefined kalau bukan dari kartu lain, mis. margin kanvas). `zone`
 *  jangkauan snap KHUSUS pasangan ini (dunia, sudah dibagi zoom) — per
 *  PASANGAN, bukan satu angka global, supaya pasangan "nempel" (target
 *  CARD_ADJACENT_GAP) bisa punya zona lebih sempit dari pasangan sejenis
 *  (lihat ADJACENT_SNAP_ZONE_PX) tanpa saling ganggu di satu pencarian. */
export interface SnapCandidatePair {
  candidateValue: number;
  targetValue: number;
  other?: Box;
  zone: number;
}

/** Bangun semua pasangan smart-guide ANTAR-KARTU satu sumbu, dari kandidat
 *  sisi kotak yang BERGERAK (null = sisi itu tak berubah pada gestur ini,
 *  tak usah dicek sama sekali — drag posisi: start/center/end ketiganya
 *  gerak bareng; resize pojok kanan-bawah: cuma `end` yang gerak) lawan
 *  tiap kartu LAIN:
 *  - start↔start, end↔end, center↔center: tepi SEJENIS, target PAS di
 *    posisi kartu lain (rata baris/kolom, delta 0) — SELALU dicek, gak
 *    peduli kartu lain itu jauh sekalipun (rata kolom/baris lintas kanvas
 *    itu wajar, gaya Figma), pakai `zone` (biasanya SNAP_ZONE_PX).
 *  - start↔(end kartu lain + GAP), end↔(start kartu lain − GAP): tepi
 *    BERLAWANAN saling mendekat ("nempel") — targetnya diberi jarak
 *    `CARD_ADJACENT_GAP`, BUKAN pas 0, dan pakai `adjacentZone` yang LEBIH
 *    SEMPIT (lihat ADJACENT_SNAP_ZONE_PX — dilaporkan pemilik: zona lebar
 *    yang sama dengan pasangan sejenis bikin susah sengaja naruh jarak
 *    10px, "ketarik" ke 5px terus). Center tak ikut skema nempel ini — tak
 *    ada makna "tengah nempel ke tengah". BEDA dari sejenis: pasangan ini
 *    CUMA dicek kalau kartu lain itu "berhadapan" — tumpang tindih SEDIKIT
 *    pun dengan kotak yang bergerak (`selfPerpStart`/`selfPerpEnd`) di
 *    sumbu TEGAK LURUS. Tanpa syarat ini, dua kartu yang sama sekali tak
 *    sebelahan bisa "ke-ikat" jarak nafas 5px cuma karena kebetulan
 *    angkanya pas — dilaporkan pemilik dari screenshot nyata: "dua card
 *    ... tidak sebelahan tapi rules 5px mengikat". */
export function cardAlignPairs(
  candidateStart: number | null,
  candidateCenter: number | null,
  candidateEnd: number | null,
  selfPerpStart: number,
  selfPerpEnd: number,
  otherBoxes: Box[],
  axis: "x" | "y",
  zone: number,
  adjacentZone: number
): SnapCandidatePair[] {
  const pairs: SnapCandidatePair[] = [];
  for (const o of otherBoxes) {
    const oStart = axis === "x" ? o.x : o.y;
    const oSize = axis === "x" ? o.w : o.h;
    const oEnd = oStart + oSize;
    const oCenter = oStart + oSize / 2;
    const oPerpStart = axis === "x" ? o.y : o.x;
    const oPerpEnd = oPerpStart + (axis === "x" ? o.h : o.w);
    const facing = oPerpEnd > selfPerpStart && oPerpStart < selfPerpEnd;
    if (candidateStart !== null) {
      pairs.push({ candidateValue: candidateStart, targetValue: oStart, other: o, zone });
      if (facing) {
        pairs.push({ candidateValue: candidateStart, targetValue: oEnd + CARD_ADJACENT_GAP, other: o, zone: adjacentZone });
      }
    }
    if (candidateCenter !== null) {
      pairs.push({ candidateValue: candidateCenter, targetValue: oCenter, other: o, zone });
    }
    if (candidateEnd !== null) {
      pairs.push({ candidateValue: candidateEnd, targetValue: oEnd, other: o, zone });
      if (facing) {
        pairs.push({ candidateValue: candidateEnd, targetValue: oStart - CARD_ADJACENT_GAP, other: o, zone: adjacentZone });
      }
    }
  }
  return pairs;
}

/** Cari SATU pasangan terdekat (gaya Figma: yang paling dekat menang, bukan
 *  yang pertama ketemu) di antara sekumpulan pasangan kandidat↔sasaran —
 *  tiap pasangan pakai `zone`-nya SENDIRI (lihat SnapCandidatePair), bukan
 *  satu zona global. null kalau tak ada yang masuk zonanya masing-masing. */
export function bestSnapPair(pairs: SnapCandidatePair[]): (SnapCandidatePair & { delta: number }) | null {
  let best: (SnapCandidatePair & { delta: number; dist: number }) | null = null;
  for (const p of pairs) {
    const dist = Math.abs(p.targetValue - p.candidateValue);
    if (dist < p.zone && (!best || dist < best.dist)) {
      best = { ...p, delta: p.targetValue - p.candidateValue, dist };
    }
  }
  return best;
}

/** Bangun garis guide (dunia) buat satu sumbu dari hasil bestSnapPair —
 *  margin (`other` undefined) selalu garis penuh; kartu lain (`other` ada)
 *  dibatasi cuma sepanjang rentang GABUNGAN kotak yang bergerak (`selfBox`)
 *  dan kotak kartu itu di sumbu TEGAK LURUSnya (garis X vertikal → rentang
 *  Y; garis Y horizontal → rentang X), gaya Figma asli — bukan garis penuh
 *  selayar. */
export function guideLineFor(
  match: (SnapCandidatePair & { delta: number }) | null,
  selfBox: Box,
  axis: "x" | "y"
): GuideLine | null {
  if (!match) return null;
  if (!match.other) return { worldPos: match.targetValue, bounded: false };
  const other = match.other;
  const [start, end] =
    axis === "x"
      ? [Math.min(selfBox.y, other.y), Math.max(selfBox.y + selfBox.h, other.y + other.h)]
      : [Math.min(selfBox.x, other.x), Math.max(selfBox.x + selfBox.w, other.x + other.w)];
  return { worldPos: match.targetValue, bounded: true, worldStart: start, worldEnd: end };
}

/** Hasil `nearestGapMeasure` — jarak (dunia) ke tetangga terdekat di satu
 *  sumbu, plus posisi buat menaruh label ("`gap`px") di layar. */
export interface GapMeasure {
  gap: number;
  gapCenterPos: number;
  worldStart: number;
  worldEnd: number;
}

/** Jarak (dunia) ke kartu LAIN terdekat yang "berhadapan" di satu sumbu —
 *  BEDA dari `cardAlignPairs`/`bestSnapPair` (itu soal SNAP, cuma aktif
 *  dalam jangkauan `SNAP_ZONE_PX`); ini murni PENGUKURAN, selalu aktif tiap
 *  ada tetangga yang relevan, apa pun jaraknya — dipakai label jarak hidup
 *  ala Figma selagi drag/resize (permintaan pemilik: "ada ukuran px ke card
 *  terdekatnya"). "Berhadapan" berarti kotak `other` tumpang tindih SEDIKIT
 *  pun dengan `selfBox` di sumbu TEGAK LURUS (kalau tidak, "jarak" di sumbu
 *  ini gak ada maknanya — dua kartu diagonal jauh bukan tetangga baris/
 *  kolom) DAN tidak tumpang tindih di sumbu ini sendiri (kalau tumpang
 *  tindih di sumbu ini, itu bukan "jarak", itu "nabrak").
 *
 *  `worldStart`/`worldEnd` (rentang buat garis/label di sumbu TEGAK LURUS)
 *  adalah IRISAN kedua kotak di sana, BUKAN gabungan — dilaporkan pemilik
 *  dari screenshot: garis pengukur kelihatan "gak nempel" ke kartu yang
 *  digeser. Gabungan (dulu dipakai, kebetulan sama rumusnya dengan
 *  `guideLineFor` yang MEMANG butuh gabungan buat garis SNAP) bisa jatuh di
 *  luar bagian yang benar-benar ditempati kedua kotak kalau tingginya beda
 *  jauh — garis jadi melayang di area yang cuma milik SATU kotak. Irisan
 *  (dijamin tak kosong oleh syarat "berhadapan" di atas) selalu ada di
 *  wilayah yang SUNGGUH ditempati kedua kartu.
 *
 *  `gap` dibulatkan ke kelipatan `GRID/2` (5px) — permintaan pemilik
 *  ("angka jarak yang muncul harus kelipatan 5") biar konsisten sama ritme
 *  grid di seluruh app, bukan angka piksel mentah selagi drag (posisi
 *  hidup belum lewat snap-ke-grid yang baru terjadi saat dilepas). */
export function nearestGapMeasure(selfBox: Box, otherBoxes: Box[], axis: "x" | "y"): GapMeasure | null {
  const selfStart = axis === "x" ? selfBox.x : selfBox.y;
  const selfEnd = selfStart + (axis === "x" ? selfBox.w : selfBox.h);
  const perpSelfStart = axis === "x" ? selfBox.y : selfBox.x;
  const perpSelfEnd = perpSelfStart + (axis === "x" ? selfBox.h : selfBox.w);

  let best: { gap: number; gapCenterPos: number; other: Box } | null = null;
  for (const o of otherBoxes) {
    const oStart = axis === "x" ? o.x : o.y;
    const oEnd = oStart + (axis === "x" ? o.w : o.h);
    const perpOStart = axis === "x" ? o.y : o.x;
    const perpOEnd = perpOStart + (axis === "x" ? o.h : o.w);
    if (perpOEnd <= perpSelfStart || perpOStart >= perpSelfEnd) continue; // tak berhadapan

    let gap: number;
    let gapCenterPos: number;
    if (oStart >= selfEnd) {
      gap = oStart - selfEnd; // other di kanan/bawah self
      gapCenterPos = selfEnd + gap / 2;
    } else if (selfStart >= oEnd) {
      gap = selfStart - oEnd; // other di kiri/atas self
      gapCenterPos = oEnd + gap / 2;
    } else {
      continue; // tumpang tindih di sumbu ini sendiri — bukan celah
    }
    if (!best || gap < best.gap) best = { gap, gapCenterPos, other: o };
  }
  if (!best) return null;
  const perpOStart = axis === "x" ? best.other.y : best.other.x;
  const perpOEnd = perpOStart + (axis === "x" ? best.other.h : best.other.w);
  const start = Math.max(perpSelfStart, perpOStart);
  const end = Math.min(perpSelfEnd, perpOEnd);
  return {
    gap: Math.round(best.gap / (GRID / 2)) * (GRID / 2),
    gapCenterPos: best.gapCenterPos,
    worldStart: start,
    worldEnd: end,
  };
}

/** Titik keluar garis dari pusat kotak menuju arah tertentu — supaya ujung
 *  panah berhenti di tepi kartu, bukan tertimbun di bawahnya. */
export function edgePoint(b: Box, toward: Point): Point {
  const c = boxCenter(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = b.w / 2;
  const hh = b.h / 2;
  // skala terkecil yang menyentuh salah satu sisi
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

const normalize = (dx: number, dy: number): Point => {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

/** Kurva bezier dari tepi kartu sumber ke tepi kartu tujuan.
 *
 *  Titik kontrol ditarik SEPANJANG arah keluar alami masing-masing kartu
 *  (vektor dari pusat kotak ke titik tepinya, `edgePoint`, diperpanjang
 *  keluar) — bukan dipaksa horizontal-dulu atau vertikal-dulu berdasar
 *  sumbu mana yang dominan (percobaan sebelumnya). Versi sumbu-dominan itu
 *  memaksa titik kontrol berbagi koordinat X/Y PERSIS dengan titik ujungnya;
 *  begitu ada selisih horizontal DAN vertikal yang sama-sama berarti (bukan
 *  murni satu sumbu), kurvanya harus berbelok tajam di tengah buat
 *  mengejar selisih itu — muncul sebagai kaitan/hook yang janggal, kepala
 *  panahnya kelihatan miring bukan tegak ke arah kartu tujuan. Menarik
 *  kontrol sepanjang arah keluar alami (bukan sumbu tetap) menghindari
 *  belokan tajam itu untuk sudut berapa pun antara dua kartu. */
export function connectorPath(source: Box, target: Box): string {
  const sc = boxCenter(source);
  const tc = boxCenter(target);
  const a = edgePoint(source, tc);
  const b = edgePoint(target, sc);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const pull = Math.max(16, Math.min(dist * 0.4, 100));
  const dirA = normalize(a.x - sc.x, a.y - sc.y);
  const dirB = normalize(b.x - tc.x, b.y - tc.y);
  const c1 = { x: a.x + dirA.x * pull, y: a.y + dirA.y * pull };
  const c2 = { x: b.x + dirB.x * pull, y: b.y + dirB.y * pull };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

/** Titik tengah antara kedua tepi kartu — tempat label/popover konektor
 *  diletakkan. Titik tengah lurus antara a/b (bukan titik tengah kurva
 *  bezier itu sendiri), cukup dekat untuk label & jauh lebih murah dihitung. */
export function connectorMidpoint(source: Box, target: Box): Point {
  const a = edgePoint(source, boxCenter(target));
  const b = edgePoint(target, boxCenter(source));
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Lengkungan horizontal-dulu antar dua TITIK polos (bukan kotak) — dipakai
 *  garis bayangan (ghost) saat menarik konektor baru, sisi tujuannya cuma
 *  kursor mentah tanpa kotak/arah keluar alami untuk ditarik sepanjangnya.
 *  Konektor sungguhan (kartu-ke-kartu) pakai `connectorPath` di atas, yang
 *  menarik kontrolnya sepanjang arah keluar tiap kotak, bukan fungsi ini. */
export function curveBetween(a: Point, b: Point): string {
  const dx = Math.abs(b.x - a.x);
  const pull = Math.max(16, Math.min(dx * 0.5, 120));
  const dir = b.x >= a.x ? 1 : -1;
  return `M ${a.x} ${a.y} C ${a.x + pull * dir} ${a.y}, ${b.x - pull * dir} ${b.y}, ${b.x} ${b.y}`;
}
