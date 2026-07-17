"use client";

import { useRef } from "react";
import { canvasBus } from "./canvasBus";
import { useCanvasStore } from "./store";
import type { CardElement } from "./types";

const DRAG_THRESHOLD = 3;

/** Drag kartu tanpa melewati React state: posisi ditulis langsung ke DOM tiap
 *  frame, store hanya di-commit sekali saat pointer dilepas. Posisi live juga
 *  disiarkan ke bus supaya konektor bisa ikut bergerak. */
export function useElementDrag(element: CardElement, enabled = true) {
  const select = useCanvasStore((s) => s.select);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const moveElement = useCanvasStore((s) => s.moveElement);

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || e.button !== 0) return;
    // Jangan mulai drag kalau yang ditekan adalah kontrol (checkbox, input,
    // tombol) — kalau tidak, pointer capture merebut fokus dan mengetik jadi
    // mustahil.
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, button, select, [contenteditable="true"]')) return;
    e.stopPropagation();
    select(element.id);
    bringToFront(element.id);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: element.x,
      startY: element.y,
      curX: element.x,
      curY: element.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const { zoom } = useCanvasStore.getState().camera;
    drag.curX = drag.startX + dx / zoom;
    drag.curY = drag.startY + dy / zoom;
    if (rootRef.current) {
      rootRef.current.style.left = `${drag.curX}px`;
      rootRef.current.style.top = `${drag.curY}px`;
    }
    canvasBus.emitMove(element.id, drag.curX, drag.curY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      moveElement(element.id, drag.curX, drag.curY);
      canvasBus.emitMoveEnd(element.id);
    }
  };

  /** true kalau pointer barusan benar-benar digeser — dipakai untuk membedakan
   *  klik dari akhir sebuah drag. */
  const wasDragged = () => dragRef.current?.moved ?? false;

  return { rootRef, wasDragged, dragHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}
