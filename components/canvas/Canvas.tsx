"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useCanvasStore } from "@/lib/store";
import { redo, startHistory, undo } from "@/lib/history";
import { copySelection, duplicateSelection, pasteClipboard } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { firstImageFile, importImageFile } from "@/lib/images";
import { useUiStore } from "@/lib/ui";
import { AgendaView } from "./AgendaView";
import { BoardCard } from "./BoardCard";
import { TopBar } from "./TopBar";
import { ConnectorEndpointHandles } from "./ConnectorEndpointHandles";
import { ConnectorLayer } from "./ConnectorLayer";
import { ConnectorPopover } from "./ConnectorPopover";
import { DatabaseCard } from "./DatabaseCard";
import { DatabaseView } from "./DatabaseView";
import { DatabaseViewCard } from "./DatabaseViewCard";
import { ImageCard } from "./ImageCard";
import { LinkCard } from "./LinkCard";
import { Minimap, computeMinimapGeo, type MinimapGeo } from "./Minimap";
import { NoteCard } from "./NoteCard";
import { PresentationBar } from "./PresentationBar";
import { SearchPanel } from "./SearchPanel";
import { ToastHost } from "./ToastHost";
import { TaskListCard } from "./TaskListCard";
import { Toolbar } from "./Toolbar";
import { ZoomControls } from "./ZoomControls";
import { CARD_GUTTER, GRID, INBOX_BOARD_ID, MAX_ZOOM, MIN_ZOOM } from "@/lib/types";
import type { Camera, CardElement, ConnectorElement } from "@/lib/types";
import { boardMinCorner, boxCenter, cardVisualBox, clampCamera } from "@/lib/geometry";
import type { Point } from "@/lib/geometry";
import { canvasBus } from "@/lib/canvasBus";
import type { GapMeasure, GuideLine } from "@/lib/canvasBus";

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const zoomBadgeRef = useRef<HTMLDivElement>(null);
  const mmViewportRef = useRef<HTMLDivElement>(null);
  const minimapGeoRef = useRef<MinimapGeo | null>(null);

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

  // Garis smart-guide (gaya Figma) — dua rupa, satu per sumbu aktif di satu
  // waktu (lihat canvasBus.emitGuideLines/GuideLine): boundaryXRef/YRef buat
  // margin kanvas (CANVAS_MARGIN_X/_Y — garis PENUH selayar, screen space
  // bukan anak world-layer biar tetap lurus di zoom berapa pun, persis pola
  // marqueeDivRef); cardGuideXRef/YRef buat nempel ke kartu LAIN (garis
  // DIBATASI cuma sepanjang rentang dua kartu yang align, posisi & panjang
  // keduanya diset live dari canvasBus).
  const boundaryXRef = useRef<HTMLDivElement>(null);
  const boundaryYRef = useRef<HTMLDivElement>(null);
  const cardGuideXRef = useRef<HTMLDivElement>(null);
  const cardGuideYRef = useRef<HTMLDivElement>(null);
  // Label + garis jarak HIDUP ("42px" + garis pendek) ke tetangga terdekat —
  // lihat canvasBus.emitGapMeasures. INDEPENDEN dari garis smart-guide/snap
  // di atas: nyala tiap ada kartu "berhadapan" di dekatnya, apa pun
  // jaraknya, bukan cuma pas benar-benar nempel/nge-snap. Garisnya
  // orientasinya KEBALIK dari boundary/cardGuide di atas — measureLineXRef
  // (celah sumbu X) itu garis DATAR (h-px), bukan tegak, karena menyusuri
  // celah itu sendiri, bukan menandai satu posisi tegak lurus.
  const gapLabelXRef = useRef<HTMLDivElement>(null);
  const gapLabelYRef = useRef<HTMLDivElement>(null);
  const measureLineXRef = useRef<HTMLDivElement>(null);
  const measureLineYRef = useRef<HTMLDivElement>(null);

  // Batas pan kiri/atas yang SUNGGUH berlaku sekarang (lihat boardMinCorner)
  // — dibaca dari ref di dalam applyCamera yang imperatif, bukan dihitung
  // ulang tiap frame pan/zoom (pemindaian linear semua elemen tiap frame
  // terlalu boros); cukup di-refresh saat kartu papan ini benar-benar
  // berubah. Sengaja TIDAK memicu re-clamp kamera secara paksa saat ini
  // berubah (lihat efek di bawah) — biar tak ada lompatan viewport
  // mendadak begitu user menggeser kartu, batas baru cukup berlaku buat
  // pan/zoom BERIKUTNYA.
  const boardMinRef = useRef<Point>({ x: 0, y: 0 });

  const elements = useCanvasStore((s) => s.elements);
  const databases = useCanvasStore((s) => s.databases);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const hydrated = useCanvasStore((s) => s.hydrated);
  const hydrate = useCanvasStore((s) => s.hydrate);
  const addNote = useCanvasStore((s) => s.addNote);
  const addImage = useCanvasStore((s) => s.addImage);
  const captureToInbox = useCanvasStore((s) => s.captureToInbox);
  const openBoard = useCanvasStore((s) => s.openBoard);
  const setCamera = useCanvasStore((s) => s.setCamera);

  const presenting = useUiStore((s) => s.presenting);
  const presentOrder = useUiStore((s) => s.presentOrder);
  const presentIndex = useUiStore((s) => s.presentIndex);
  const presentNext = useUiStore((s) => s.presentNext);
  const presentPrev = useUiStore((s) => s.presentPrev);
  const exitPresentation = useUiStore((s) => s.exitPresentation);
  const openSearch = useUiStore((s) => s.openSearch);
  const showGrid = useUiStore((s) => s.showGrid);
  const preCamRef = useRef<Camera | null>(null);
  const wasPresenting = useRef(false);
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

  // Jumlah item per papan, dihitung sekali dari seluruh elemen — supaya tiap
  // BoardCard tidak memindai `elements` sendiri (O(kartu papan × elemen)).
  const countByBoard = useMemo(() => {
    const m = new Map<string, number>();
    for (const el of Object.values(elements)) m.set(el.boardId, (m.get(el.boardId) ?? 0) + 1);
    return m;
  }, [elements]);

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

  // Geometri minimap dari kotak-batas kartu (null bila papan kosong).
  const minimapGeo = useMemo(
    () => computeMinimapGeo(cards.map((c) => ({ x: c.x, y: c.y, width: c.width }))),
    [cards]
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => startHistory(), []);

  useEffect(() => {
    boardMinRef.current = boardMinCorner(elements, currentBoardId);
  }, [elements, currentBoardId]);

  const applyCamera = useCallback(() => {
    // Kiri/atas kanvas adalah batas keras (x=0/y=0 tak pernah kelihatan di
    // luar itu, gaya Milanote) — diberlakukan di sini supaya SEMUA jalur yang
    // menggerakkan kamera (wheel, pan pointer, tombol zoom, minimap, dst) lolos
    // titik yang sama, tanpa kecuali.
    cameraRef.current = clampCamera(cameraRef.current, boardMinRef.current);
    const { x, y, zoom } = cameraRef.current;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    }
    // Grid titik BUKAN anak world-layer (lihat komentar di render) — disinkron
    // lewat background-position/-size, bukan ikut transform. Elemennya tetap
    // seukuran viewport (murah dirender ulang), jadi selalu tajam & tak pernah
    // ikut jadi bitmap yang di-scale.
    if (gridRef.current) {
      const tile = GRID * zoom;
      const halfTile = tile / 2;
      gridRef.current.style.backgroundSize = `${tile}px ${tile}px, ${halfTile}px ${halfTile}px`;
      // radial-gradient default posisinya di TENGAH tiap ubin, bukan di
      // pojoknya — digeser setengah ubin supaya titik yang terlihat memang
      // jatuh di kelipatan GRID (titik dunia yang sama dipakai snap saat
      // drag), bukan di antaranya. Layer kedua menambah dot minor di tengah
      // jarak itu (GRID/2) dengan opacity lebih rendah, supaya grid terasa
      // lebih rapat tanpa mengubah snap 10px. Ditambah CARD_GUTTER*zoom supaya
      // fase dot mengikuti tepi PERMUKAAN kartu yang terlihat (2px lebih ke
      // dalam dari kotak posisi kelipatan-grid-nya, gara-gara margin `m-0.5`).
      const gutter = CARD_GUTTER * zoom;
      gridRef.current.style.backgroundPosition =
        `${x - tile / 2 + gutter}px ${y - tile / 2 + gutter}px, ` +
        `${x - halfTile / 2 + gutter}px ${y - halfTile / 2 + gutter}px`;
    }
    if (zoomBadgeRef.current) {
      zoomBadgeRef.current.textContent = `${Math.round(zoom * 100)}% · tersimpan otomatis (lokal)`;
    }
    // Kotak viewport minimap ikut bergerak live (imperatif, sama seperti pan).
    const geo = minimapGeoRef.current;
    const vp = mmViewportRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (geo && vp && rect) {
      const vx = -x / zoom;
      const vy = -y / zoom;
      vp.style.left = `${geo.offsetX + (vx - geo.minX) * geo.scale}px`;
      vp.style.top = `${geo.offsetY + (vy - geo.minY) * geo.scale}px`;
      vp.style.width = `${(rect.width / zoom) * geo.scale}px`;
      vp.style.height = `${(rect.height / zoom) * geo.scale}px`;
    }
  }, []);

  // Garis smart-guide (margin kanvas ATAU kartu lain) — lihat
  // boundaryXRef/YRef & cardGuideXRef/YRef di atas. Posisi (dan, buat versi
  // dibatasi, panjang) dihitung dari cameraRef SAAT itu (dunia → layar,
  // rumus sama seperti clampCamera), sengaja tidak ikut applyCamera tiap
  // frame pan/zoom — garis ini cuma relevan selagi drag kartu berlangsung
  // (pan & drag kartu lain tidak terjadi bersamaan).
  useEffect(() => {
    const applyGuide = (
      line: GuideLine | null,
      fullRef: RefObject<HTMLDivElement | null>,
      boundedRef: RefObject<HTMLDivElement | null>,
      axis: "x" | "y"
    ) => {
      const cam = cameraRef.current;
      const full = fullRef.current;
      const bounded = boundedRef.current;
      if (!line) {
        if (full) full.style.display = "none";
        if (bounded) bounded.style.display = "none";
        return;
      }
      if (!line.bounded) {
        if (bounded) bounded.style.display = "none";
        if (full) {
          if (axis === "x") full.style.left = `${cam.x + line.worldPos * cam.zoom}px`;
          else full.style.top = `${cam.y + line.worldPos * cam.zoom}px`;
          full.style.display = "block";
        }
        return;
      }
      if (full) full.style.display = "none";
      if (bounded) {
        const start = (line.worldStart ?? 0) * cam.zoom;
        const end = (line.worldEnd ?? 0) * cam.zoom;
        if (axis === "x") {
          bounded.style.left = `${cam.x + line.worldPos * cam.zoom}px`;
          bounded.style.top = `${cam.y + start}px`;
          bounded.style.height = `${end - start}px`;
        } else {
          bounded.style.top = `${cam.y + line.worldPos * cam.zoom}px`;
          bounded.style.left = `${cam.x + start}px`;
          bounded.style.width = `${end - start}px`;
        }
        bounded.style.display = "block";
      }
    };

    canvasBus.setGuideLineHandler((x, y) => {
      applyGuide(x, boundaryXRef, cardGuideXRef, "x");
      applyGuide(y, boundaryYRef, cardGuideYRef, "y");
    });
    return () => canvasBus.setGuideLineHandler(null);
  }, []);

  // Label + garis jarak hidup ("5px" + garis pendek menyambung celahnya) ke
  // tetangga terdekat — lihat canvasBus.emitGapMeasures/GapMeasure
  // (geometry.ts). INDEPENDEN dari garis smart-guide di atas: tampil tiap
  // ada tetangga "berhadapan", bukan cuma pas benar-benar nge-snap
  // (permintaan pemilik: "ukuran px ke card terdekatnya" selagi drag/
  // resize, bukan cuma saat nempel persis). Garisnya SENGAJA beda orientasi
  // dari garis smart-guide (yang X = tegak, Y = datar): ini menyusuri
  // CELAHnya sendiri — celah sumbu X (dua kartu bersisian kiri-kanan)
  // digambar garis DATAR sepanjang celah itu, bukan garis tegak (dilaporkan
  // pemilik: sebelum ini cuma angkanya doang yang muncul, gak ada garis
  // sama sekali). Titik ujung celah = `gapCenterPos ∓ gap/2` (simetris,
  // gak perlu field baru di GapMeasure). */
  useEffect(() => {
    const applyMeasure = (
      m: GapMeasure | null,
      labelRef: RefObject<HTMLDivElement | null>,
      lineRef: RefObject<HTMLDivElement | null>,
      axis: "x" | "y"
    ) => {
      const cam = cameraRef.current;
      const label = labelRef.current;
      const line = lineRef.current;
      if (!m) {
        if (label) label.style.display = "none";
        if (line) line.style.display = "none";
        return;
      }
      const perpMid = cam[axis === "x" ? "y" : "x"] + ((m.worldStart + m.worldEnd) / 2) * cam.zoom;
      const edgeA = (m.gapCenterPos - m.gap / 2) * cam.zoom;
      const edgeB = (m.gapCenterPos + m.gap / 2) * cam.zoom;
      if (axis === "x") {
        if (label) {
          label.style.left = `${cam.x + m.gapCenterPos * cam.zoom}px`;
          label.style.top = `${perpMid}px`;
        }
        if (line) {
          line.style.top = `${perpMid}px`;
          line.style.left = `${cam.x + edgeA}px`;
          line.style.width = `${edgeB - edgeA}px`;
        }
      } else {
        if (label) {
          label.style.top = `${cam.y + m.gapCenterPos * cam.zoom}px`;
          label.style.left = `${perpMid}px`;
        }
        if (line) {
          line.style.left = `${perpMid}px`;
          line.style.top = `${cam.y + edgeA}px`;
          line.style.height = `${edgeB - edgeA}px`;
        }
      }
      if (label) {
        // m.gap sudah dibulatkan ke kelipatan 5 di nearestGapMeasure —
        // dipakai apa adanya, bukan dibulatkan ulang di sini.
        label.textContent = `${m.gap}px`;
        label.style.display = "block";
      }
      if (line) line.style.display = "block";
    };

    canvasBus.setGapMeasureHandler((x, y) => {
      applyMeasure(x, gapLabelXRef, measureLineXRef, "x");
      applyMeasure(y, gapLabelYRef, measureLineYRef, "y");
    });
    return () => canvasBus.setGapMeasureHandler(null);
  }, []);

  // world-layer HANYA dipromosikan jadi compositor layer (willChange:
  // "transform") SELAGI gestur aktif — supaya pan/zoom digeser GPU tanpa
  // React, itulah yang bikin gestur mulus. Begitu diam, hint itu dilepas
  // sepenuhnya supaya browser melukis normal (bukan bitmap hasil promosi yang
  // di-scale GPU) — teks kembali tajam di resolusi asli.
  //
  // (Percobaan sebelumnya mencoba toggle willChange off→on lagi di titik yang
  // sama untuk "memaksa" raster ulang — itu TIDAK bekerja: membaca offsetHeight
  // cuma memaksa *layout*, bukan *paint*; dua tulisan style dalam tugas JS yang
  // sama nyaris pasti digabung jadi satu commit render oleh browser, jadi state
  // "auto"-nya tak pernah benar-benar dilukis. Desain ini menggantinya dengan
  // ON-di-awal-gestur / OFF-di-akhir — tanpa toggle balik, tanpa tebakan soal
  // kapan browser mem-paint.)
  const setLive = useCallback(() => {
    const el = worldRef.current;
    if (el && el.style.willChange !== "transform") el.style.willChange = "transform";
  }, []);
  const settleRaster = useCallback(() => {
    const el = worldRef.current;
    if (el) el.style.willChange = "auto";
  }, []);

  // Sinkron ref ← store saat kamera store berubah — commit gesture (akhir
  // wheel-zoom/pan), klik tombol zoom/minimap, focusElement, buka papan lain,
  // dst. Semuanya titik "diam" (store hanya di-update di akhir gestur, bukan
  // tiap frame) → titik yang tepat untuk melepas promosi compositor.
  // useLayoutEffect agar transform diterapkan sebelum paint.
  const storeCamera = useCanvasStore((s) => s.camera);
  useLayoutEffect(() => {
    cameraRef.current = storeCamera;
    applyCamera();
    settleRaster();
  }, [storeCamera, applyCamera, settleRaster]);

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

  // Pusatkan kamera pada satu titik world (dipakai klik/geser minimap),
  // pertahankan zoom saat ini.
  const panTo = useCallback(
    (worldX: number, worldY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const zoom = cameraRef.current.zoom;
      cameraRef.current = {
        x: (rect?.width ?? 0) / 2 - worldX * zoom,
        y: (rect?.height ?? 0) / 2 - worldY * zoom,
        zoom,
      };
      applyCamera();
      commitNow();
    },
    [applyCamera, commitNow]
  );

  // Jaga ref geometri minimap tetap sinkron & reposisi kotak viewport saat
  // kumpulan kartu berubah (mis. tambah/hapus).
  useLayoutEffect(() => {
    minimapGeoRef.current = minimapGeo;
    applyCamera();
  }, [minimapGeo, applyCamera]);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (clientX - (rect?.left ?? 0) - cam.x) / cam.zoom,
      y: (clientY - (rect?.top ?? 0) - cam.y) / cam.zoom,
    };
  }, []);

  const viewportCenterWorld = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: ((rect?.width ?? 0) / 2 - cam.x) / cam.zoom,
      y: ((rect?.height ?? 0) / 2 - cam.y) / cam.zoom,
    };
  }, []);

  const placeImageFile = useCallback(
    async (file: File, world: { x: number; y: number }) => {
      const img = await importImageFile(file);
      if (img) addImage(world.x, world.y, img);
    },
    [addImage]
  );

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
      setLive();
      applyCamera();
      scheduleCommit();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyCamera, scheduleCommit, setLive]);

  // Delete/Backspace hapus elemen terpilih (kecuali sedang mengetik); Esc batal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Tangkapan cepat harus jalan dari MANA SAJA — termasuk saat sedang
      // mengetik di editor note (contentEditable) — supaya benar-benar tanpa
      // gesekan. Karena itu dicek sebelum guard "sedang mengetik" di bawah.
      // Konsekuensinya Cmd+I tak lagi jadi italic di editor; ditukar demi
      // tangkap-dari-mana-saja. TAPI jangan mencuri fokus dari field form
      // (pencarian, email login): di INPUT/TEXTAREA, biarkan lewat.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
        e.preventDefault();
        captureToInbox();
        return;
      }
      // Buka pencarian dari mana saja (Cmd/Ctrl+K).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
        return;
      }

      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // Overlay (pencarian / tabel database) menutupi kanvas → jangan biarkan
      // shortcut yang mengubah kanvas di belakangnya (hapus, salin, undo, dll.)
      // jalan. Escape tetap lewat supaya bisa dipakai menutup.
      const ui = useUiStore.getState();
      if ((ui.searchOpen || ui.openDatabaseId) && e.key !== "Escape") return;

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

      // Copy / duplicate. Paste ditangani lewat event 'paste' terpisah supaya
      // bisa membedakan gambar dari clipboard (→ kartu gambar) dari tempelan
      // internal. Di dalam kartu teks kita sudah keluar di atas.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      const { selectedIds, editingId } = useCanvasStore.getState();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length && !editingId) {
        const n = selectedIds.length;
        removeMany(selectedIds);
        // Hapus bisa mengikis subpohon papan yang besar — beri jalan pulang.
        toast(n > 1 ? `${n} kartu dihapus` : "Kartu dihapus", {
          actionLabel: "Urungkan",
          onAction: undo,
        });
      }
      if (e.key === "Escape") {
        setEditing(null);
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeMany, select, setEditing, captureToInbox, openSearch]);

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

  // Tempel (Ctrl/Cmd+V): gambar dari clipboard → kartu gambar; selain itu →
  // tempelan internal. Disatukan di sini karena hanya event 'paste' yang
  // membawa data gambar. Saat mengetik di kartu, biarkan tempel bawaan.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

      let file = firstImageFile(e.clipboardData?.files ?? null);
      if (!file) {
        const items = e.clipboardData?.items;
        if (items) {
          for (const it of items) {
            if (it.type.startsWith("image/")) {
              file = it.getAsFile();
              break;
            }
          }
        }
      }

      e.preventDefault();
      if (file) void placeImageFile(file, viewportCenterWorld());
      else pasteClipboard();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [placeImageFile, viewportCenterWorld]);

  // Presentation Mode: pada tiap langkah, pusatkan & pas-kan kamera ke kartunya.
  // Saat masuk: simpan kamera awal, aktifkan transisi halus + kunci interaksi
  // kartu. Saat keluar: pulihkan kamera & lepas kunci. useLayoutEffect supaya
  // penyimpanan kamera awal terjadi sebelum langkah pertama menggesernya.
  useLayoutEffect(() => {
    const world = worldRef.current;
    if (presenting && !wasPresenting.current) {
      preCamRef.current = { ...cameraRef.current };
      if (world) {
        world.style.transition = "transform 350ms ease";
        world.style.pointerEvents = "none";
      }
    }
    if (!presenting && wasPresenting.current) {
      if (world) {
        world.style.transition = "";
        world.style.pointerEvents = "";
      }
      if (preCamRef.current) {
        setCamera(preCamRef.current);
        preCamRef.current = null;
      }
    }
    wasPresenting.current = presenting;
    if (!presenting) return;

    const id = presentOrder[presentIndex];
    const el = useCanvasStore.getState().elements[id];
    if (!el || el.type === "CONNECTOR") return;
    const rect = containerRef.current?.getBoundingClientRect();
    const W = rect?.width ?? window.innerWidth;
    const H = rect?.height ?? window.innerHeight;
    const node = document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
    // Kotak permukaan yang SUNGGUH terlihat (bukan kotak posisi mentah, yang
    // sengaja lebih besar 2×CARD_GUTTER) — tanpa ini kartu sedikit bias ke
    // kiri-atas & fit-nya tak sepenuhnya mengikuti tepi yang kelihatan.
    const box = cardVisualBox(el, node, 120);
    const { x: wx, y: wy } = boxCenter(box);
    // Pas-kan kartu ke ~2/3 viewport, dijepit ke rentang zoom kanvas.
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(W / (box.w * 1.5), H / (box.h * 1.6))));
    setCamera({ x: W / 2 - wx * zoom, y: H / 2 - wy * zoom, zoom });
  }, [presenting, presentIndex, presentOrder, setCamera]);

  // Navigasi presentasi lewat keyboard. Capture phase + stopImmediatePropagation
  // supaya pintasan kanvas biasa tidak ikut bereaksi saat presentasi.
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        presentNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        presentPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        exitPresentation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [presenting, presentNext, presentPrev, exitPresentation]);

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
      // Lebar diukur dari DOM (bukan el.width mentah) — root SENGAJA lebih
      // lebar dari el.width sejak fix gutter-grid (lihat CARD_GUTTER), sama
      // seperti tinggi yang sudah lebih dulu diukur dari DOM di atas.
      const w = node?.offsetWidth ?? el.width;
      // AABB overlap antara marquee dan kotak kartu.
      if (el.x < wx2 && el.x + w > wx1 && el.y < wy2 && el.y + h > wy1) {
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
    if (presenting) return; // kanvas view-only saat presentasi
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
      setLive();
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

  // Satu jalur untuk mengakhiri gesture — dipakai pointerup (selesai normal)
  // maupun pointercancel/lostpointercapture (dibatalkan browser/blur), supaya
  // kursor tak nyangkut "grabbing", marquee tak tertinggal, dan kamera tetap
  // di-commit. Pada pembatalan, seleksi marquee tidak di-commit.
  const endGesture = (e: React.PointerEvent, cancelled: boolean) => {
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      if (containerRef.current) containerRef.current.style.cursor = spaceRef.current ? "grab" : "default";
      commitNow();
      return;
    }
    if (marqueeRef.current?.pointerId === e.pointerId) {
      if (!cancelled) commitMarquee();
      marqueeRef.current = null;
      if (marqueeDivRef.current) marqueeDivRef.current.style.display = "none";
    }
  };

  const onPointerUp = (e: React.PointerEvent) => endGesture(e, false);
  const onPointerCancel = (e: React.PointerEvent) => endGesture(e, true);

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
      className="relative h-dvh w-full overflow-hidden bg-[#f6f6f7] touch-none select-none"
      data-canvas-bg="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault(); // izinkan drop
      }}
      onDrop={(e) => {
        const file = firstImageFile(e.dataTransfer.files);
        if (file) {
          e.preventDefault();
          void placeImageFile(file, screenToWorld(e.clientX, e.clientY));
        }
      }}
    >
      {/* Grid titik: SENGAJA di luar world-layer (bukan ikut transform pan/zoom).
          Seukuran viewport + background-position/-size disinkron imperatif di
          applyCamera — jadi tak pernah jadi bagian dari layer raksasa yang
          di-scale sebagai bitmap (itulah yang bikin teks pecah selagi zoom
          aktif; lihat komentar sharpenAtRest di bawah). Murah dirender ulang
          tiap frame karena ukurannya cuma sebesar viewport. */}
      <div
        ref={gridRef}
        data-export-ignore="true"
        className="pointer-events-none absolute inset-0"
        // Mati secara default. Saat dinyalakan, ada dot mayor di GRID dan dot
        // minor di GRID/2; minor sengaja lebih transparan supaya kerapatan naik
        // tanpa terasa seperti noise. Ukuran dot tetap dalam px layar, hanya
        // jarak antar dot yang mengikuti zoom lewat applyCamera.
        style={{
          backgroundImage: showGrid
            ? [
                "radial-gradient(circle, rgba(0,0,0,0.075) 0.72px, transparent 0.72px)",
                "radial-gradient(circle, rgba(0,0,0,0.032) 0.58px, transparent 0.58px)",
              ].join(", ")
            : "none",
        }}
      />

      {/* Layer dunia: semua elemen (kartu + garis). Digeser/diskala lewat satu
          transform. willChange TIDAK diset di sini — sengaja mulai "diam"
          (dilukis normal, tajam); setLive()/settleRaster() yang mengatur
          promosi compositor hanya selama gestur aktif (lihat komentar di
          dekat definisinya). */}
      <div
        id="world-layer"
        ref={worldRef}
        className="absolute left-0 top-0"
        style={{ transformOrigin: "0 0" }}
      >
        {/* Garis digambar sebelum kartu → selalu tampil di bawahnya */}
        {hydrated && <ConnectorLayer connectors={connectors} relations={relations} cards={cards} />}

        {hydrated &&
          cards.map((el) => {
            if (el.type === "BOARD_REF")
              return <BoardCard key={el.id} element={el} count={countByBoard.get(el.content.boardId) ?? 0} />;
            if (el.type === "TASK_LIST") return <TaskListCard key={el.id} element={el} />;
            if (el.type === "LINK") return <LinkCard key={el.id} element={el} />;
            if (el.type === "IMAGE") return <ImageCard key={el.id} element={el} />;
            if (el.type === "DATABASE_REF") return <DatabaseCard key={el.id} element={el} />;
            if (el.type === "DATABASE_VIEW") return <DatabaseViewCard key={el.id} element={el} />;
            return <NoteCard key={el.id} element={el} />;
          })}

        {/* Dot snap + handle seret ujung konektor — DI ATAS kartu (beda dari
            ConnectorLayer yang sengaja di bawah), cuma tampil buat konektor
            yang lagi dipilih (sama trigger dengan ConnectorPopover). */}
        {hydrated && <ConnectorEndpointHandles />}
      </div>

      {hydrated && cards.length === 0 && !presenting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-xl bg-white/80 p-6 text-center shadow-sm ring-1 ring-neutral-200 backdrop-blur">
            <p className="text-sm font-medium text-neutral-700">Kanvas ini masih kosong</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const cam = cameraRef.current;
                  const wx = ((rect?.width ?? 0) / 2 - cam.x) / cam.zoom;
                  const wy = ((rect?.height ?? 0) / 2 - cam.y) / cam.zoom;
                  addNote(wx, wy);
                }}
                className="rounded-md bg-forest-700 px-3 py-1.5 text-sm text-white hover:bg-forest-800"
              >
                + Catatan
              </button>
              {currentBoardId !== INBOX_BOARD_ID && (
                <button
                  onClick={() => openBoard(INBOX_BOARD_ID)}
                  className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200"
                >
                  📥 Buka Inbox
                </button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              Klik dua kali di mana saja untuk catatan cepat · geser untuk geser kanvas ·
              scroll/pinch untuk zoom · bilah bawah untuk papan, tabel & gambar
            </p>
          </div>
        </div>
      )}

      {/* Kotak marquee (koordinat layar, di luar world-layer). Disembunyikan
          sampai ada geseran; digambar imperatif lewat marqueeDivRef. */}
      <div
        ref={marqueeDivRef}
        className="pointer-events-none absolute z-10 hidden rounded-sm border border-forest-400 bg-forest-400/10"
      />

      {/* Garis smart-guide margin kanvas (gaya Figma) — penuh selayar, muncul/
          nge-snap selagi kartu digeser mendekati batas kanvas, disembunyikan
          lagi begitu drag selesai. Diposisikan imperatif lewat canvasBus.
          Warna forest-400, SAMA dengan ring seleksi kartu (dipertahankan atas
          klarifikasi pemilik) — TANPA halo putih (sempat ditambah, lalu
          dilaporkan dari screenshot bikin tabrakan gak terbaca pas garis
          lewat pas di tepi kartu berwarna sama; halo putihnya-lah biang
          keroknya, bukan warnanya — garis polos 1px ternyata cukup). */}
      <div
        ref={boundaryXRef}
        className="pointer-events-none absolute inset-y-0 z-10 hidden w-px bg-forest-400"
      />
      <div
        ref={boundaryYRef}
        className="pointer-events-none absolute inset-x-0 z-10 hidden h-px bg-forest-400"
      />

      {/* Garis smart-guide antar-kartu (gaya Figma) — DIBATASI, cuma
          sepanjang rentang kartu yang digeser dan kartu lain yang align
          (bukan penuh selayar seperti garis margin di atas). Posisi & ukuran
          keduanya diset live lewat canvasBus, bukan cuma posisi. */}
      <div
        ref={cardGuideXRef}
        className="pointer-events-none absolute z-10 hidden w-px bg-forest-400"
      />
      <div
        ref={cardGuideYRef}
        className="pointer-events-none absolute z-10 hidden h-px bg-forest-400"
      />

      {/* Garis pendek yang menyusuri celah itu sendiri (BEDA orientasi dari
          garis smart-guide di atas — lihat komentar measureLineXRef) — biar
          jaraknya kelihatan sebagai celah SUNGGUHAN, bukan cuma angka
          mengambang tanpa acuan (dilaporkan pemilik: "cuma ada angkanya
          saja tapi tidak ada garisnya"). */}
      <div
        ref={measureLineXRef}
        className="pointer-events-none absolute z-10 hidden h-px bg-forest-400"
      />
      <div
        ref={measureLineYRef}
        className="pointer-events-none absolute z-10 hidden w-px bg-forest-400"
      />

      {/* Label jarak hidup ("42px") ke tetangga terdekat selagi drag/resize —
          lihat nearestGapMeasure di geometry.ts. Pill kecil biar terbaca di
          atas kanvas apa pun. Independen dari status snap — nyala tiap ada
          kartu "berhadapan" yang relevan, bukan cuma pas nempel/nge-snap. */}
      <div
        ref={gapLabelXRef}
        className="pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-forest-700 px-1 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
      />
      <div
        ref={gapLabelYRef}
        className="pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-forest-700 px-1 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
      />

      {/* Saat presentasi: sembunyikan semua chrome, tampilkan hanya bilah kontrol. */}
      {presenting ? (
        <PresentationBar />
      ) : (
        <>
          <TopBar />
          <Toolbar containerRef={containerRef} cameraRef={cameraRef} />
          <ZoomControls />
          <AgendaView />
          <DatabaseView />
          <SearchPanel />
          <ConnectorPopover />
          {minimapGeo && (
            <Minimap geo={minimapGeo} cards={cards} viewportRef={mmViewportRef} onNavigate={panTo} />
          )}

          <span ref={zoomBadgeRef} className="sr-only" />
        </>
      )}

      {/* Toast selalu tampil (termasuk saat presentasi) — konfirmasi aksi. */}
      <ToastHost />
    </div>
  );
}
