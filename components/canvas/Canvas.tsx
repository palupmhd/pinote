"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { redo, startHistory, undo } from "@/lib/history";
import { copySelection, duplicateSelection, pasteClipboard } from "@/lib/clipboard";
import { AgendaView } from "./AgendaView";
import { BoardCard } from "./BoardCard";
import { Breadcrumb } from "./Breadcrumb";
import { ConnectorLayer } from "./ConnectorLayer";
import { DatabaseCard } from "./DatabaseCard";
import { DatabaseView } from "./DatabaseView";
import { LinkCard } from "./LinkCard";
import { NoteCard } from "./NoteCard";
import { SyncStatus } from "./SyncStatus";
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

  // Marquee (rubber-band): koordinat layar relatif container. Digambar imperatif
  // ke satu div overlay — nol re-render, sejalan dengan filosofi kanvas ini.
  const marqueeRef = useRef<{ pointerId: number; startX: number; startY: number; curX: number; curY: number } | null>(null);
  const marqueeDivRef = useRef<HTMLDivElement>(null);
  // Space ditahan → left-drag jadi pan (gaya Figma), bukan marquee.
  const spaceRef = useRef(false);

  const elements = useCanvasStore((s) => s.elements);
  const databases = useCanvasStore((s) => s.databases);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const hydrated = useCanvasStore((s) => s.hydrated);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const addNote = useCanvasStore((s) => s.addNote);
  const select = useCanvasStore((s) => s.select);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const removeMany = useCanvasStore((s) => s.removeMany);

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

  // Panah relasi (spec §8.6): diturunkan dari kolom relasi antar tabel, BUKAN
  // disimpan sebagai elemen. Satu panah per pasangan (kartu sumber → kartu
  // tujuan) yang punya minimal satu tautan baris, dan hanya bila kedua kartu
  // ada di papan yang sedang dibuka. Memakai ulang rendering konektor.
  const relations = useMemo(() => {
    const cardByDb = new Map<string, string>();
    for (const el of cards) {
      if (el.type === "DATABASE_REF") cardByDb.set(el.content.databaseId, el.id);
    }
    const seen = new Set<string>();
    const arrows: { id: string; sourceElementId: string; targetElementId: string }[] = [];
    for (const el of cards) {
      if (el.type !== "DATABASE_REF") continue;
      const db = databases[el.content.databaseId];
      if (!db) continue;
      for (const col of db.columns) {
        if (col.type !== "relation" || !col.targetDatabaseId) continue;
        const targetId = cardByDb.get(col.targetDatabaseId);
        if (!targetId || targetId === el.id) continue;
        const hasLink = db.rows.some(
          (r) => Array.isArray(r.cells[col.id]) && (r.cells[col.id] as string[]).length > 0
        );
        if (!hasLink) continue;
        const key = `${el.id}->${targetId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        arrows.push({ id: key, sourceElementId: el.id, targetElementId: targetId });
      }
    }
    return arrows;
  }, [cards, databases]);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => startHistory(), []);

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

      // Undo/redo. Saat mengetik di kartu, kita sudah keluar di atas → editor
      // teks pakai undo bawaan browser; di kanvas kosong, ini yang jalan.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Copy / paste / duplicate. Di dalam kartu teks kita sudah keluar di atas,
      // jadi Ctrl+C/V bawaan untuk teks tetap jalan; ini hanya untuk kanvas.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      const { selectedIds, editingId } = useCanvasStore.getState();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length && !editingId) {
        removeMany(selectedIds);
      }
      if (e.key === "Escape") {
        setEditing(null);
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeMany, select, setEditing]);

  // Space = tahan-untuk-pan. Diabaikan saat mengetik supaya spasi tetap terketik.
  useEffect(() => {
    const editable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !editable(e.target) && !spaceRef.current) {
        spaceRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = "grab";
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        if (containerRef.current && !panRef.current) containerRef.current.style.cursor = "default";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const isBackground = (e: React.PointerEvent | React.MouseEvent) =>
    (e.target as HTMLElement).dataset.canvasBg === "true";

  const drawMarquee = useCallback(() => {
    const m = marqueeRef.current;
    const div = marqueeDivRef.current;
    if (!m || !div) return;
    const x = Math.min(m.startX, m.curX);
    const y = Math.min(m.startY, m.curY);
    div.style.display = "block";
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.width = `${Math.abs(m.curX - m.startX)}px`;
    div.style.height = `${Math.abs(m.curY - m.startY)}px`;
  }, []);

  const commitMarquee = useCallback(() => {
    const m = marqueeRef.current;
    if (!m) return;
    // Geseran mungil = klik biasa → seleksi sudah dikosongkan saat pointer turun.
    if (Math.abs(m.curX - m.startX) < 4 && Math.abs(m.curY - m.startY) < 4) return;
    const cam = cameraRef.current;
    const toWorldX = (sx: number) => (sx - cam.x) / cam.zoom;
    const toWorldY = (sy: number) => (sy - cam.y) / cam.zoom;
    const wx1 = toWorldX(Math.min(m.startX, m.curX));
    const wx2 = toWorldX(Math.max(m.startX, m.curX));
    const wy1 = toWorldY(Math.min(m.startY, m.curY));
    const wy2 = toWorldY(Math.max(m.startY, m.curY));

    const st = useCanvasStore.getState();
    const hits: string[] = [];
    for (const el of Object.values(st.elements)) {
      if (el.boardId !== st.currentBoardId || el.type === "CONNECTOR") continue;
      const node = document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
      const h = node?.offsetHeight ?? 64;
      // AABB overlap antara marquee dan kotak kartu.
      if (el.x < wx2 && el.x + el.width > wx1 && el.y < wy2 && el.y + h > wy1) {
        hits.push(el.id);
      }
    }
    setSelection(hits);
  }, [setSelection]);

  const startPan = (e: React.PointerEvent) => {
    const cam = cameraRef.current;
    panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y };
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Pan: tombol tengah, atau Space + kiri di mana saja.
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      startPan(e);
      return;
    }
    // Kiri di latar (tanpa Space): mulai marquee & kosongkan seleksi lama.
    if (e.button === 0 && isBackground(e)) {
      select(null);
      setEditing(null);
      const rect = containerRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      marqueeRef.current = { pointerId: e.pointerId, startX: sx, startY: sy, curX: sx, curY: sy };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      cameraRef.current = {
        ...cameraRef.current,
        x: pan.camX + (e.clientX - pan.startX),
        y: pan.camY + (e.clientY - pan.startY),
      };
      applyCamera(); // imperatif — tanpa re-render React
      return;
    }
    const m = marqueeRef.current;
    if (m && m.pointerId === e.pointerId) {
      const rect = containerRef.current!.getBoundingClientRect();
      m.curX = e.clientX - rect.left;
      m.curY = e.clientY - rect.top;
      drawMarquee();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      if (containerRef.current) containerRef.current.style.cursor = spaceRef.current ? "grab" : "default";
      commitNow();
      return;
    }
    if (marqueeRef.current?.pointerId === e.pointerId) {
      commitMarquee();
      marqueeRef.current = null;
      if (marqueeDivRef.current) marqueeDivRef.current.style.display = "none";
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
        {hydrated && <ConnectorLayer connectors={connectors} relations={relations} cards={cards} />}

        {hydrated &&
          cards.map((el) => {
            if (el.type === "BOARD_REF") return <BoardCard key={el.id} element={el} />;
            if (el.type === "TASK_LIST") return <TaskListCard key={el.id} element={el} />;
            if (el.type === "LINK") return <LinkCard key={el.id} element={el} />;
            if (el.type === "DATABASE_REF") return <DatabaseCard key={el.id} element={el} />;
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

      {/* Kotak marquee (koordinat layar, di luar world-layer). Disembunyikan
          sampai ada geseran; digambar imperatif lewat marqueeDivRef. */}
      <div
        ref={marqueeDivRef}
        className="pointer-events-none absolute z-10 hidden rounded-sm border border-blue-400 bg-blue-400/10"
      />

      <Breadcrumb />
      <Toolbar containerRef={containerRef} cameraRef={cameraRef} />
      <SyncStatus />
      <AgendaView />
      <DatabaseView />

      <div
        ref={zoomBadgeRef}
        className="pointer-events-none absolute bottom-3 right-4 text-xs text-neutral-400"
      >
        100% · tersimpan otomatis (lokal)
      </div>
    </div>
  );
}
