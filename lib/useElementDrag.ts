"use client";

import { useRef } from "react";
import { canvasBus } from "./canvasBus";
import { useCanvasStore } from "./store";
import type { CardElement } from "./types";

const DRAG_THRESHOLD = 3;

interface Member {
  id: string;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  node: HTMLElement | null;
}

/** Drag kartu tanpa melewati React state: posisi ditulis langsung ke DOM tiap
 *  frame, store hanya di-commit sekali saat pointer dilepas. Posisi live juga
 *  disiarkan ke bus supaya konektor bisa ikut bergerak.
 *
 *  Kalau kartu ini bagian dari seleksi jamak, SEMUA yang terpilih ikut bergeser
 *  dengan delta yang sama (group drag), dan di-commit sebagai satu langkah. */
export function useElementDrag(element: CardElement, enabled = true) {
  const select = useCanvasStore((s) => s.select);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const moveMany = useCanvasStore((s) => s.moveMany);

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    members: Member[];
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || e.button !== 0) return;
    // Jangan mulai drag kalau yang ditekan adalah kontrol (checkbox, input,
    // tombol, tautan) — kalau tidak, pointer capture merebut fokus dan
    // mengetik/klik tautan jadi mustahil.
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, button, select, a, [contenteditable="true"]')) return;
    e.stopPropagation();

    // Shift/Ctrl-klik: toggle keanggotaan seleksi, tanpa memulai geseran.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      select(element.id, true);
      return;
    }

    const st = useCanvasStore.getState();
    const inMulti = st.selectedIds.includes(element.id) && st.selectedIds.length > 1;
    // Klik kartu di luar seleksi → jadikan seleksi tunggal. Klik salah satu dari
    // seleksi jamak → pertahankan seleksinya dan geser seluruh grup.
    if (!inMulti) select(element.id);
    bringToFront(element.id);

    const groupIds = inMulti ? st.selectedIds : [element.id];
    const members: Member[] = groupIds
      .map((id) => st.elements[id])
      .filter((el): el is CardElement => !!el && el.type !== "CONNECTOR")
      .map((el) => ({
        id: el.id,
        startX: el.x,
        startY: el.y,
        curX: el.x,
        curY: el.y,
        node: document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`),
      }));

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      members,
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
    for (const m of drag.members) {
      m.curX = m.startX + dx / zoom;
      m.curY = m.startY + dy / zoom;
      const node = m.node ?? (m.id === element.id ? rootRef.current : null);
      if (node) {
        node.style.left = `${m.curX}px`;
        node.style.top = `${m.curY}px`;
      }
      canvasBus.emitMove(m.id, m.curX, m.curY);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      moveMany(drag.members.map((m) => ({ id: m.id, x: m.curX, y: m.curY })));
      for (const m of drag.members) canvasBus.emitMoveEnd(m.id);
    }
  };

  /** true kalau pointer barusan benar-benar digeser — dipakai untuk membedakan
   *  klik dari akhir sebuah drag. */
  const wasDragged = () => dragRef.current?.moved ?? false;

  return { rootRef, wasDragged, dragHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}
