"use client";

import { useRef } from "react";
import { canvasBus } from "@/lib/canvasBus";
import { cardBoxFromDom, worldPointFromClient } from "@/lib/domGeometry";
import { boxCenter } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import type { CardElement } from "@/lib/types";

/** Titik kecil di tepi kanan kartu. Tarik ke kartu lain untuk membuat garis. */
export function ConnectHandle({ element, selected }: { element: CardElement; selected: boolean }) {
  const addConnector = useCanvasStore((s) => s.addConnector);
  const dragging = useRef<number | null>(null);

  const toWorld = (clientX: number, clientY: number) =>
    worldPointFromClient(clientX, clientY, useCanvasStore.getState().camera.zoom);

  const sourcePoint = () => boxCenter(cardBoxFromDom(element));

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

  // Pointer dibatalkan (pointercancel), tab blur, atau capture hilang → bereskan
  // ghost supaya garis sementara tidak tertinggal di kanvas.
  const onCancel = (e: React.PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    dragging.current = null;
    canvasBus.emitGhost(null, null);
  };

  return (
    // Area klik sengaja lebih besar (h-7 w-7 ≈ 28px) dari dot yang terlihat
    // (h-4 w-4 ≈ 16px, span dalam) — dot mungil gampang meleset diklik;
    // pusatnya dijaga sama supaya posisinya tak kelihatan geser.
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      title="Tarik ke elemen lain untuk menghubungkan"
      className="absolute -right-4 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-crosshair items-center justify-center"
    >
      <span
        className={[
          "h-4 w-4 rounded-full border-2 border-white bg-forest-400 shadow transition-opacity",
          selected ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
    </div>
  );
}
