"use client";

import { useRef } from "react";
import { canvasBus } from "@/lib/canvasBus";
import { boxCenter } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import type { CardElement } from "@/lib/types";

const FALLBACK_HEIGHT = 64;

/** Titik kecil di tepi kanan kartu. Tarik ke kartu lain untuk membuat garis. */
export function ConnectHandle({ element }: { element: CardElement }) {
  const addConnector = useCanvasStore((s) => s.addConnector);
  const dragging = useRef<number | null>(null);

  const toWorld = (clientX: number, clientY: number) => {
    // getBoundingClientRect world layer sudah memuat translate kamera,
    // jadi cukup dibagi zoom — tak perlu baca posisi kamera terpisah.
    const world = document.getElementById("world-layer");
    const rect = world?.getBoundingClientRect();
    const { zoom } = useCanvasStore.getState().camera;
    return {
      x: ((clientX - (rect?.left ?? 0)) / zoom),
      y: ((clientY - (rect?.top ?? 0)) / zoom),
    };
  };

  const sourcePoint = () => {
    const node = document.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`);
    return boxCenter({
      x: element.x,
      y: element.y,
      w: element.width,
      h: node?.offsetHeight ?? FALLBACK_HEIGHT,
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // jangan ikut men-drag kartunya
    dragging.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    canvasBus.emitGhost(sourcePoint(), toWorld(e.clientX, e.clientY));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    canvasBus.emitGhost(sourcePoint(), toWorld(e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    dragging.current = null;
    canvasBus.emitGhost(null, null);

    // Kartu apa yang ada di bawah kursor saat dilepas?
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const targetId = under?.closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    if (targetId) addConnector(element.id, targetId);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Tarik ke elemen lain untuk menghubungkan"
      className="absolute -right-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-blue-400 opacity-0 shadow transition-opacity group-hover:opacity-100"
    />
  );
}
