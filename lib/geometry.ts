import { CANVAS_MARGIN, CARD_GUTTER, GRID } from "./types";
import type { Box, Camera } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Bulatkan ke kelipatan `step` terdekat (default GRID) — satu fungsi dipakai
 *  drag (posisi, selalu kelipatan GRID penuh) DAN resize (lebar/tinggi, bisa
 *  diminta kelipatan GRID/2 supaya ikut menempel ke dot minor di tengah grid
 *  mayor — lihat pemanggilan di ResizeHandle.tsx). */
export const snapToGrid = (v: number, step: number = GRID): number => Math.round(v / step) * step;

/** Kiri/atas kanvas adalah tepi keras: dunia di bawah `CANVAS_MARGIN` (world
 *  x/y) tak pernah boleh kelihatan (gaya "halaman" Milanote, bukan bidang
 *  tak-berhingga ke segala arah). `moveMany` memakai batas yang sama hanya
 *  untuk mencegah kartu masuk melewati margin, bukan untuk menempelkan kartu
 *  paling kiri/atas ke tepi layar.
 *  Pada zoom berapa pun, titik dunia (CANVAS_MARGIN, CANVAS_MARGIN) ada di
 *  layar pada posisi `camera.{x,y} + CANVAS_MARGIN*zoom` — jadi supaya sisi
 *  kiri/atas viewport tak pernah menunjukkan koordinat di bawah batas itu,
 *  `camera.x`/`camera.y` tak boleh lebih dari `-CANVAS_MARGIN*zoom`.
 *  Kanan/bawah tetap tak terbatas (biarkan tumbuh mengikuti kartu). */
export function clampCamera(cam: Camera): Camera {
  const limit = -CANVAS_MARGIN * cam.zoom;
  return { ...cam, x: Math.min(cam.x, limit), y: Math.min(cam.y, limit) };
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
