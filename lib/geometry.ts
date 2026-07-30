import { CANVAS_MARGIN, GRID } from "./types";
import type { Box, Camera } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Bulatkan ke kelipatan GRID terdekat — satu fungsi dipakai drag (posisi) DAN
 *  resize (lebar/tinggi) supaya semuanya konsisten menempel ke titik dot yang
 *  sama. */
export const snapToGrid = (v: number): number => Math.round(v / GRID) * GRID;

/** Kiri/atas kanvas adalah tepi keras: dunia di bawah `CANVAS_MARGIN` (world
 *  x/y) tak pernah boleh kelihatan (gaya "halaman" Milanote, bukan bidang
 *  tak-berhingga ke segala arah — lihat juga normalisasi papan di
 *  store.ts:moveMany yang menegakkan batas yang sama dari sisi kartu).
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

/** Kurva bezier dari tepi kartu sumber ke tepi kartu tujuan. */
export function connectorPath(source: Box, target: Box): string {
  const a = edgePoint(source, boxCenter(target));
  const b = edgePoint(target, boxCenter(source));
  return curveBetween(a, b);
}

/** Titik tengah antara kedua tepi kartu — tempat label/popover konektor
 *  diletakkan. Titik tengah lurus antara a/b (bukan titik tengah kurva
 *  bezier itu sendiri), cukup dekat untuk label & jauh lebih murah dihitung. */
export function connectorMidpoint(source: Box, target: Box): Point {
  const a = edgePoint(source, boxCenter(target));
  const b = edgePoint(target, boxCenter(source));
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Lengkungan S yang mengikuti sumbu yang lebih dominan (horizontal ATAU
 *  vertikal), bukan selalu horizontal-dulu seperti sebelumnya. Versi lama
 *  memaksa lengkung horizontal bahkan untuk pasangan kartu yang hubungannya
 *  jelas lebih vertikal (atas-bawah) — akibatnya kepala panah nempel di
 *  ujung kurva yang condong ke samping, bukan tegak lurus ke arah kartu
 *  tujuan, kelihatan "aneh". Sekarang arah lengkungnya ikut sumbu mana yang
 *  jaraknya lebih jauh (`edgePoint` juga sudah memilih tepi keluar radial
 *  berdasar arah yang sama, jadi keduanya selalu sepakat). Lantai `pull`
 *  juga diturunkan (28→16) supaya kartu yang berdekatan tak dapat lengkungan
 *  besar yang tak perlu untuk jarak sedekat itu. */
export function curveBetween(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const dist = horizontal ? Math.abs(dx) : Math.abs(dy);
  const pull = Math.max(16, Math.min(dist * 0.5, 120));
  if (horizontal) {
    const dir = dx >= 0 ? 1 : -1;
    return `M ${a.x} ${a.y} C ${a.x + pull * dir} ${a.y}, ${b.x - pull * dir} ${b.y}, ${b.x} ${b.y}`;
  }
  const dir = dy >= 0 ? 1 : -1;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + pull * dir}, ${b.x} ${b.y - pull * dir}, ${b.x} ${b.y}`;
}
