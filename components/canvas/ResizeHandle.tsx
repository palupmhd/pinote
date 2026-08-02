"use client";

import { useRef, type RefObject } from "react";
import { canvasBus } from "@/lib/canvasBus";
import {
  bestSnapPair,
  cardAlignPairs,
  cardVisualBox,
  guideLineFor,
  nearestGapMeasure,
  snapToGrid,
  SNAP_ZONE_PX,
} from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import { CARD_GUTTER, GRID, MIN_CARD_HEIGHT, MIN_CARD_WIDTH } from "@/lib/types";
import type { Box, CardElement } from "@/lib/types";

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
    otherBoxes: Box[];
  } | null>(null);
  // Label ukuran ("240 × 120") selagi resize — gaya Figma/Sketch, dipasang
  // LOKAL di sini (bukan lewat canvasBus seperti garis guide) karena tak
  // perlu koordinasi lintas-kartu, cukup jadi anak DOM kartu ini sendiri.
  const dimsRef = useRef<HTMLDivElement>(null);

  const heightTarget = () => contentRef?.current ?? rootRef.current;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // jangan ikut men-drag/memindah kartunya
    // Tinggi mungkin belum pernah di-set (auto ikut konten) — pakai tinggi
    // yang benar-benar dirender sekarang sebagai titik awal, bukan 0.
    const startHeight = element.height ?? heightTarget()?.offsetHeight ?? MIN_CARD_HEIGHT;

    // Kotak visual kartu LAIN di papan yang sama — dihitung SEKALI di sini,
    // bukan tiap frame (sama alasannya dengan useElementDrag.ts): kartu lain
    // diam sepanjang resize ini, cukup dibaca sekali. Dipakai smart-guide
    // buat tepi kanan/bawah yang bergerak selagi resize (lihat smartGuideSize).
    const st = useCanvasStore.getState();
    const otherBoxes: Box[] = Object.values(st.elements)
      .filter(
        (el): el is CardElement => el.type !== "CONNECTOR" && el.boardId === st.currentBoardId && el.id !== element.id
      )
      .map((el) => cardVisualBox(el, document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`), MIN_CARD_HEIGHT));

    drag.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: element.width,
      startHeight,
      otherBoxes,
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

  // Smart-guide (gaya Figma, lihat cardAlignPairs/geometry.ts) buat resize —
  // BEDA dari drag posisi: cuma tepi KANAN (lebar) dan BAWAH (tinggi) yang
  // bergerak selagi resize pojok kanan-bawah, kiri/atas/tengah kartu diam
  // (`element.x`/`y` tak berubah) — makanya cuma kandidat "end" yang dioper
  // ke cardAlignPairs (start/center-nya null, tak usah dicek). Dites lawan
  // tepi/tengah kartu LAIN saja, tak ada margin kanvas (resize tak berurusan
  // dengan batas dunia). Match yang ketemu LANGSUNG jadi lebar/tinggi akhir
  // (bukan cuma delta) — grid-snap di bawah tetap jalan di atasnya sebagai
  // jaring pengaman, tapi biasanya sudah no-op karena tepi kartu lain sudah
  // kelipatan grid juga.
  const smartGuideSize = (
    d: NonNullable<typeof drag.current>,
    raw: { width: number; height: number },
    zoom: number
  ) => {
    const zone = SNAP_ZONE_PX / zoom;
    const selfLeft = element.x + CARD_GUTTER;
    const selfTop = element.y + CARD_GUTTER;
    const matchX = bestSnapPair(
      cardAlignPairs(null, null, selfLeft + raw.width, d.otherBoxes, "x"),
      zone
    );
    const matchY = bestSnapPair(
      cardAlignPairs(null, null, selfTop + raw.height, d.otherBoxes, "y"),
      zone
    );
    const width = matchX ? matchX.targetValue - selfLeft : raw.width;
    const height = matchY ? matchY.targetValue - selfTop : raw.height;
    const selfBox: Box = { x: selfLeft, y: selfTop, w: width, h: height };
    return {
      width,
      height,
      guideX: guideLineFor(matchX, selfBox, "x"),
      guideY: guideLineFor(matchY, selfBox, "y"),
      // Label jarak hidup ke tetangga terdekat (permintaan pemilik) — dari
      // kotak SETELAH smart-guide (posisi yang benar-benar dirender),
      // independen dari status snap, sama pola dengan useElementDrag.ts.
      measureX: nearestGapMeasure(selfBox, d.otherBoxes, "x"),
      measureY: nearestGapMeasure(selfBox, d.otherBoxes, "y"),
    };
  };

  // GRID/2: resize boleh berhenti di dot minor (di tengah grid mayor) juga,
  // bukan cuma kelipatan GRID penuh seperti posisi kartu (drag) — beda dari
  // snapToGrid(v) default yang dipakai useElementDrag/addImage. Dipakai SAMA
  // baik selagi drag (preview) maupun saat commit — bukan cuma di commit
  // (versi lama) — supaya tepi yang kelihatan selagi menyeret sudah PERSIS di
  // dot yang bakal ditempati, bukan mengikuti piksel mentah lalu "melompat" ke
  // dot terdekat begitu dilepas (dilaporkan pemilik: tepi kelihatan gak pas di
  // titik yang dituju, kartu jatuh bukan di dot yang dimau).
  const snappedSizeAt = (d: NonNullable<typeof drag.current>, e: React.PointerEvent) => {
    const raw = sizeAt(d, e);
    const { zoom } = useCanvasStore.getState().camera;
    const { width, height, guideX, guideY, measureX, measureY } = smartGuideSize(d, raw, zoom);
    return {
      width: Math.max(MIN_CARD_WIDTH, snapToGrid(width, GRID / 2)),
      height: Math.max(MIN_CARD_HEIGHT, snapToGrid(height, GRID / 2)),
      guideX,
      guideY,
      measureX,
      measureY,
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
    const { width, height, guideX, guideY, measureX, measureY } = snappedSizeAt(d, e);
    if (rootRef.current) rootRef.current.style.width = `${width + CARD_GUTTER * 2}px`;
    const h = heightTarget();
    if (h) h.style.height = `${height}px`;
    canvasBus.emitGuideLines(guideX, guideY);
    canvasBus.emitGapMeasures(measureX, measureY);
    if (dimsRef.current) {
      dimsRef.current.textContent = `${width} × ${height}`;
      dimsRef.current.style.display = "block";
    }
  };

  const commit = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    canvasBus.emitGuideLines(null, null);
    canvasBus.emitGapMeasures(null, null);
    if (dimsRef.current) dimsRef.current.style.display = "none";
    const { width, height } = snappedSizeAt(d, e);
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
    <>
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
      {/* "240 × 120" — cuma tampil selagi resize aktif (lihat onPointerMove/
          commit), nongkrong di bawah pojok kanan-bawah biar tak ketiban jari/
          kursor yang lagi narik handle-nya. */}
      <div
        ref={dimsRef}
        className="pointer-events-none absolute -bottom-6 right-0 z-20 hidden whitespace-nowrap rounded bg-forest-700 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
      />
    </>
  );
}
