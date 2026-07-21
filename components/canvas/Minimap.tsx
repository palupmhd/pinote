"use client";

import { useRef, type RefObject } from "react";

/** Minimap (spec §6 gap #5): peta kecil semua kartu papan + kotak viewport yang
 *  bisa diklik/geser untuk berpindah cepat. */
const MM_W = 176;
const MM_H = 120;
const MM_INSET = 8;
const MM_PAD = 48; // ruang tepi dalam koordinat world
/** Tinggi kartu tak ada di data (ikut isi); untuk peta kasar cukup nominal. */
export const MM_CARD_H = 64;

export interface MinimapGeo {
  W: number;
  H: number;
  minX: number;
  minY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Hitung geometri minimap dari kotak-batas kartu, atau null bila kosong. */
export function computeMinimapGeo(cards: { x: number; y: number; width: number }[]): MinimapGeo | null {
  if (cards.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cards) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + MM_CARD_H);
  }
  minX -= MM_PAD;
  minY -= MM_PAD;
  maxX += MM_PAD;
  maxY += MM_PAD;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const innerW = MM_W - 2 * MM_INSET;
  const innerH = MM_H - 2 * MM_INSET;
  const scale = Math.min(innerW / bw, innerH / bh);
  const offsetX = MM_INSET + (innerW - bw * scale) / 2;
  const offsetY = MM_INSET + (innerH - bh * scale) / 2;
  return { W: MM_W, H: MM_H, minX, minY, scale, offsetX, offsetY };
}

interface Props {
  geo: MinimapGeo;
  cards: { id: string; x: number; y: number; width: number }[];
  /** Div kotak viewport — diposisikan imperatif oleh Canvas (ikut pan/zoom live). */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Pindahkan kamera supaya berpusat di titik world ini. */
  onNavigate: (worldX: number, worldY: number) => void;
}

export function Minimap({ geo, cards, viewportRef, onNavigate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const navTo = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const mx = clientX - r.left;
    const my = clientY - r.top;
    onNavigate(geo.minX + (mx - geo.offsetX) / geo.scale, geo.minY + (my - geo.offsetY) / geo.scale);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        navTo(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging.current) navTo(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      title="Minimap — klik atau geser untuk berpindah"
      className="pointer-events-auto absolute bottom-3 left-3 z-10 cursor-pointer overflow-hidden rounded-md bg-white/80 shadow-sm ring-1 ring-neutral-200 backdrop-blur"
      style={{ width: geo.W, height: geo.H }}
    >
      {cards.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-[1px] bg-neutral-300"
          style={{
            left: geo.offsetX + (c.x - geo.minX) * geo.scale,
            top: geo.offsetY + (c.y - geo.minY) * geo.scale,
            width: Math.max(2, c.width * geo.scale),
            height: Math.max(2, MM_CARD_H * geo.scale),
          }}
        />
      ))}
      <div
        ref={viewportRef}
        className="absolute border border-blue-500/70 bg-blue-400/10"
        style={{ left: 0, top: 0, width: 0, height: 0 }}
      />
    </div>
  );
}
