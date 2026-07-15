"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { NoteCard } from "./NoteCard";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; camX: number; camY: number } | null>(null);

  const elements = useCanvasStore((s) => s.elements);
  const camera = useCanvasStore((s) => s.camera);
  const hydrated = useCanvasStore((s) => s.hydrated);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const addNote = useCanvasStore((s) => s.addNote);
  const select = useCanvasStore((s) => s.select);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const removeElement = useCanvasStore((s) => s.removeElement);

  useEffect(() => hydrate(), [hydrate]);

  // Wheel: pan (default) / zoom ke arah kursor (ctrl atau pinch trackpad).
  // Dipasang manual karena listener wheel React bersifat passive → preventDefault tidak jalan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { camera } = useCanvasStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0022);
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
        const scale = zoom / camera.zoom;
        useCanvasStore.getState().setCamera({
          x: cx - (cx - camera.x) * scale,
          y: cy - (cy - camera.y) * scale,
          zoom,
        });
      } else {
        useCanvasStore.getState().setCamera({
          ...camera,
          x: camera.x - e.deltaX,
          y: camera.y - e.deltaY,
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Delete/Backspace menghapus elemen terpilih — kecuali sedang mengetik
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const { selectedId, editingId } = useCanvasStore.getState();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editingId) {
        removeElement(selectedId);
      }
      if (e.key === "Escape") {
        setEditing(null);
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeElement, select, setEditing]);

  const isBackground = (e: React.PointerEvent | React.MouseEvent) =>
    (e.target as HTMLElement).dataset.canvasBg === "true";

  const onPointerDown = (e: React.PointerEvent) => {
    // Pan: drag area kosong (klik kiri) atau tombol tengah di mana saja
    if (e.button === 1 || (e.button === 0 && isBackground(e))) {
      if (isBackground(e)) {
        select(null);
        setEditing(null);
      }
      panRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        camX: camera.x,
        camY: camera.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    setCamera({
      ...useCanvasStore.getState().camera,
      x: pan.camX + (e.clientX - pan.startX),
      y: pan.camY + (e.clientY - pan.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (panRef.current?.pointerId === e.pointerId) panRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!isBackground(e)) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
    const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;
    addNote(worldX, worldY);
  };

  const gridSize = 24 * camera.zoom;

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full overflow-hidden bg-neutral-100 touch-none select-none"
      style={{
        backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
        cursor: panRef.current ? "grabbing" : "default",
      }}
      data-canvas-bg="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Layer dunia: semua elemen hidup di koordinat world, digeser/diskala via transform */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {hydrated &&
          Object.values(elements).map((el) => <NoteCard key={el.id} element={el} />)}
      </div>

      {/* Hint kosong */}
      {hydrated && Object.keys(elements).length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-400">
            Klik dua kali di mana saja untuk membuat catatan
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-4 text-xs text-neutral-400">
        {Math.round(camera.zoom * 100)}% · tersimpan otomatis (lokal)
      </div>
    </div>
  );
}
