"use client";

import { useRef, type RefObject } from "react";
import { snapToGrid } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import { MIN_CARD_WIDTH } from "@/lib/types";
import type { CardElement } from "@/lib/types";

/** Simpul kecil di pojok kanan-bawah kartu — tarik untuk ubah lebar. Sama
 *  seperti drag posisi (useElementDrag): lebar ditulis langsung ke DOM tiap
 *  frame (nol re-render), baru di-snap ke grid & di-commit ke store saat
 *  pointer dilepas. */
export function ResizeHandle({
  element,
  rootRef,
}: {
  element: CardElement;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const resizeElement = useCanvasStore((s) => s.resizeElement);
  const drag = useRef<{ pointerId: number; startClientX: number; startWidth: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // jangan ikut men-drag/memindah kartunya
    drag.current = { pointerId: e.pointerId, startClientX: e.clientX, startWidth: element.width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const { zoom } = useCanvasStore.getState().camera;
    const width = Math.max(MIN_CARD_WIDTH, d.startWidth + (e.clientX - d.startClientX) / zoom);
    if (rootRef.current) rootRef.current.style.width = `${width}px`;
  };

  const commit = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    const { zoom } = useCanvasStore.getState().camera;
    const raw = Math.max(MIN_CARD_WIDTH, d.startWidth + (e.clientX - d.startClientX) / zoom);
    const width = Math.max(MIN_CARD_WIDTH, snapToGrid(raw));
    if (rootRef.current) rootRef.current.style.width = `${width}px`;
    resizeElement(element.id, width);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    commit(e);
  };

  // Pointer dibatalkan (blur tab, capture hilang) — commit posisi terakhir yang
  // diketahui alih-alih membiarkan lebar kartu nyangkut beda dari store.
  const onCancel = (e: React.PointerEvent) => commit(e);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      title="Tarik untuk ubah lebar"
      className="absolute -right-1 -bottom-1 z-10 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-indigo-400 opacity-0 shadow transition-opacity group-hover:opacity-100"
    />
  );
}
