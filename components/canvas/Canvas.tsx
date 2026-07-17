"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { BoardCard } from "./BoardCard";
import { Breadcrumb } from "./Breadcrumb";
import { ConnectorLayer } from "./ConnectorLayer";
import { NoteCard } from "./NoteCard";
import { TaskListCard } from "./TaskListCard";
import { Toolbar } from "./Toolbar";
import type { CardElement, ConnectorElement } from "@/lib/types";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const GRID = 24;
const GRID_EXTENT = 6000; // area grid (world units) di tiap arah dari origin

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomBadgeRef = useRef<HTMLDivElement>(null);

  // Kamera "hidup" disimpan di ref, BUKAN di React state — supaya pan/zoom
  // tidak memicu re-render tiap frame. State store hanya di-commit saat gesture
  // selesai (untuk persistence + koordinat pembuatan note).
  const cameraRef = useRef(useCanvasStore.getState().camera);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; camX: number; camY: number } | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const elements = useCanvasStore((s) => s.elements);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const hydrated = useCanvasStore((s) => s.hydrated);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const addNote = useCanvasStore((s) => s.addNote);
  const select = useCanvasStore((s) => s.select);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const removeElement = useCanvasStore((s) => s.removeElement);

  // Hanya elemen milik papan yang sedang dibuka yang dirender.
  const visible = useMemo(
    () => Object.values(elements).filter((e) => e.boardId === currentBoardId),
    [elements, currentBoardId]
  );
  const cards = useMemo(
    () => visible.filter((e): e is CardElement => e.type !== "CONNECTOR"),
    [visible]
  );
  const connectors = useMemo(
    () => visible.filter((e): e is ConnectorElement => e.type === "CONNECTOR"),
    [visible]
  );

  useEffect(() => hydrate(), [hydrate]);

  const applyCamera = useCallback(() => {
    const { x, y, zoom } = cameraRef.current;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    }
    if (zoomBadgeRef.current) {
      zoomBadgeRef.current.textContent = `${Math.round(zoom * 100)}% · tersimpan otomatis (lokal)`;
    }
  }, []);

  // Sinkron ref ← store saat kamera store berubah (mis. setelah hydrate atau
  // commit gesture). Tidak berjalan selama gesture karena kita tidak menyentuh
  // store camera saat itu. useLayoutEffect agar transform diterapkan sebelum paint.
  const storeCamera = useCanvasStore((s) => s.camera);
  useLayoutEffect(() => {
    cameraRef.current = storeCamera;
    applyCamera();
  }, [storeCamera, applyCamera]);

  const scheduleCommit = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      useCanvasStore.getState().setCamera({ ...cameraRef.current });
    }, 200);
  }, []);

  const commitNow = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    useCanvasStore.getState().setCamera({ ...cameraRef.current });
  }, []);

  // Wheel: pan (default) / zoom ke arah kursor (ctrl / pinch trackpad).
  // Listener manual karena wheel React bersifat passive → preventDefault tak jalan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0022);
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
        const scale = zoom / cam.zoom;
        cameraRef.current = {
          x: cx - (cx - cam.x) * scale,
          y: cy - (cy - cam.y) * scale,
          zoom,
        };
      } else {
        cameraRef.current = { ...cam, x: cam.x - e.deltaX, y: cam.y - e.deltaY };
      }
      applyCamera();
      scheduleCommit();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyCamera, scheduleCommit]);

  // Delete/Backspace hapus elemen terpilih (kecuali sedang mengetik); Esc batal
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
    if (e.button === 1 || (e.button === 0 && isBackground(e))) {
      if (isBackground(e)) {
        select(null);
        setEditing(null);
      }
      const cam = cameraRef.current;
      panRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        camX: cam.x,
        camY: cam.y,
      };
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    cameraRef.current = {
      ...cameraRef.current,
      x: pan.camX + (e.clientX - pan.startX),
      y: pan.camY + (e.clientY - pan.startY),
    };
    applyCamera(); // imperatif — tanpa re-render React
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      if (containerRef.current) containerRef.current.style.cursor = "default";
      commitNow();
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!isBackground(e)) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const cam = cameraRef.current;
    const worldX = (e.clientX - rect.left - cam.x) / cam.zoom;
    const worldY = (e.clientY - rect.top - cam.y) / cam.zoom;
    addNote(worldX, worldY);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full overflow-hidden bg-neutral-100 touch-none select-none"
      data-canvas-bg="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Layer dunia: grid + semua elemen. Digeser/diskala lewat satu transform
          (GPU-composited). Grid jadi anak layer ini → ikut transform, tidak
          pernah di-repaint per frame. */}
      <div
        id="world-layer"
        ref={worldRef}
        className="absolute left-0 top-0"
        style={{ transformOrigin: "0 0", willChange: "transform" }}
      >
        <div
          className="pointer-events-none absolute"
          style={{
            left: -GRID_EXTENT,
            top: -GRID_EXTENT,
            width: GRID_EXTENT * 2,
            height: GRID_EXTENT * 2,
            backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
        />
        {/* Garis digambar sebelum kartu → selalu tampil di bawahnya */}
        {hydrated && <ConnectorLayer connectors={connectors} cards={cards} />}

        {hydrated &&
          cards.map((el) => {
            if (el.type === "BOARD_REF") return <BoardCard key={el.id} element={el} />;
            if (el.type === "TASK_LIST") return <TaskListCard key={el.id} element={el} />;
            return <NoteCard key={el.id} element={el} />;
          })}
      </div>

      {hydrated && cards.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-400">
            Klik dua kali di mana saja untuk membuat catatan
          </p>
        </div>
      )}

      <Breadcrumb />
      <Toolbar containerRef={containerRef} cameraRef={cameraRef} />

      <div
        ref={zoomBadgeRef}
        className="pointer-events-none absolute bottom-3 right-4 text-xs text-neutral-400"
      >
        100% · tersimpan otomatis (lokal)
      </div>
    </div>
  );
}
