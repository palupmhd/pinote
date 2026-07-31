"use client";

import { useRef, type RefObject } from "react";
import { snapToGrid } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import { CARD_GUTTER, GRID, MIN_CARD_HEIGHT, MIN_CARD_WIDTH } from "@/lib/types";
import type { CardElement } from "@/lib/types";

/** Simpul kecil di pojok kanan-bawah kartu — tarik untuk ubah lebar DAN
 *  tinggi sekaligus (dua sumbu, seperti resize pojok pada umumnya). Sama
 *  seperti drag posisi (useElementDrag): ukuran ditulis langsung ke DOM tiap
 *  frame (nol re-render), baru di-snap ke grid & di-commit ke store saat
 *  pointer dilepas.
 *
 *  Lebar selalu diterapkan ke `rootRef` (kotak kartu). Tinggi diterapkan ke
 *  `contentRef` kalau dioper (wrapper konten yang boleh di-`overflow-y:auto`
 *  tanpa memotong ConnectHandle/ResizeHandle/CardActionBar yang posisinya
 *  absolute sedikit di luar root) — kalau tidak dioper, tinggi ikut ke root
 *  (dipakai ImageCard: root-nya sendiri sudah `overflow-hidden` buat crop
 *  gambar, tak ada risiko teks kepotong). */
export function ResizeHandle({
  element,
  rootRef,
  contentRef,
}: {
  element: CardElement;
  rootRef: RefObject<HTMLDivElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
}) {
  const resizeElement = useCanvasStore((s) => s.resizeElement);
  const drag = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const heightTarget = () => contentRef?.current ?? rootRef.current;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // jangan ikut men-drag/memindah kartunya
    // Tinggi mungkin belum pernah di-set (auto ikut konten) — pakai tinggi
    // yang benar-benar dirender sekarang sebagai titik awal, bukan 0.
    const startHeight = element.height ?? heightTarget()?.offsetHeight ?? MIN_CARD_HEIGHT;
    drag.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: element.width,
      startHeight,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const sizeAt = (d: NonNullable<typeof drag.current>, e: React.PointerEvent) => {
    const { zoom } = useCanvasStore.getState().camera;
    return {
      width: Math.max(MIN_CARD_WIDTH, d.startWidth + (e.clientX - d.startClientX) / zoom),
      height: Math.max(MIN_CARD_HEIGHT, d.startHeight + (e.clientY - d.startClientY) / zoom),
    };
  };

  // Root ditulis width+2*CARD_GUTTER (bukan width mentah) — root itu kotak
  // posisi yang SENGAJA lebih lebar dari ukuran "logis", supaya permukaan
  // bermargin di dalamnya (lihat CARD_GUTTER di lib/types.ts) menyusut PAS
  // balik ke `width` yang kelipatan grid, bukan `width - 2*gutter` yang
  // ganjil. Tanpa ini kartu akan "melompat" 2*gutter px pas dilepas, begitu
  // React re-render dengan style width final dari commit() di bawah.
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const { width, height } = sizeAt(d, e);
    if (rootRef.current) rootRef.current.style.width = `${width + CARD_GUTTER * 2}px`;
    const h = heightTarget();
    if (h) h.style.height = `${height}px`;
  };

  const commit = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    const raw = sizeAt(d, e);
    // GRID/2: resize boleh berhenti di dot minor (di tengah grid mayor) juga,
    // bukan cuma kelipatan GRID penuh seperti posisi kartu (drag) — beda dari
    // snapToGrid(v) default yang dipakai useElementDrag/addImage.
    const width = Math.max(MIN_CARD_WIDTH, snapToGrid(raw.width, GRID / 2));
    const height = Math.max(MIN_CARD_HEIGHT, snapToGrid(raw.height, GRID / 2));
    if (rootRef.current) rootRef.current.style.width = `${width + CARD_GUTTER * 2}px`;
    const h = heightTarget();
    if (h) h.style.height = `${height}px`;
    resizeElement(element.id, { width, height });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    commit(e);
  };

  // Pointer dibatalkan (blur tab, capture hilang) — commit ukuran terakhir
  // yang diketahui alih-alih membiarkan kartu nyangkut beda dari store.
  const onCancel = (e: React.PointerEvent) => commit(e);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      title="Tarik untuk ubah ukuran"
      // -right/-bottom PERSIS -CARD_GUTTER (2px, lib/types.ts) — dulu -4px
      // (sebelum ada gutter), jadi sudulnya nongol 2px lewat batas kotak
      // posisi (outer), menimpa sudut kartu tetangga kalau posisinya rapat.
      // Diklem pas di tepi gutter supaya tak pernah melewati kartu sendiri.
      className="absolute -right-[2px] -bottom-[2px] z-10 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-forest-400 opacity-0 shadow transition-opacity group-hover:opacity-100"
    />
  );
}
