import type { Box } from "./types";

export interface Point {
  x: number;
  y: number;
}

export const boxCenter = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Titik keluar garis dari pusat kotak menuju arah tertentu — supaya ujung
 *  panah berhenti di tepi kartu, bukan tertimbun di bawahnya. */
function edgePoint(b: Box, toward: Point): Point {
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

/** Lengkungan horizontal-dulu: terbaca sebagai alur, bukan garis kaku. */
export function curveBetween(a: Point, b: Point): string {
  const dx = Math.abs(b.x - a.x);
  const pull = Math.max(28, Math.min(dx * 0.5, 120));
  const dir = b.x >= a.x ? 1 : -1;
  return `M ${a.x} ${a.y} C ${a.x + pull * dir} ${a.y}, ${b.x - pull * dir} ${b.y}, ${b.x} ${b.y}`;
}
