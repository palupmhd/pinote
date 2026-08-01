"use client";

import { useRef } from "react";
import { canvasBus } from "./canvasBus";
import {
  ADJACENT_SNAP_ZONE_PX,
  bestSnapPair,
  cardAlignPairs,
  cardVisualBox,
  guideLineFor,
  nearestGapMeasure,
  snapToGrid,
  SNAP_ZONE_PX,
  type GapMeasure,
  type GuideLine,
  type SnapCandidatePair,
} from "./geometry";
import { useCanvasStore } from "./store";
import { CANVAS_MARGIN_X, CANVAS_MARGIN_Y, GRID, MIN_CARD_HEIGHT } from "./types";
import type { Box, CardElement } from "./types";

const DRAG_THRESHOLD = 3;
// GRID/2: posisi kartu juga boleh berhenti di dot minor (di tengah grid
// mayor), sama seperti resize (lihat ResizeHandle.tsx) — bukan cuma
// kelipatan GRID penuh.
const snap = (v: number) => snapToGrid(v, GRID / 2);

interface Member {
  id: string;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  width: number;
  node: HTMLElement | null;
}

/** Kotak visual (permukaan yang sungguh terlihat) satu anggota grup pada
 *  posisi MENTAH-nya sekarang (curX/curY, sebelum smart-guide) — dipakai
 *  baik buat kotak gabungan grup maupun (tak langsung) buat menimbang match. */
function memberVisualBox(m: Member): Box {
  return cardVisualBox({ x: m.curX, y: m.curY, width: m.width }, m.node, MIN_CARD_HEIGHT);
}

/** Kotak gabungan (bounding box) SEMUA anggota grup yang sedang digeser —
 *  smart-guide menimbang tepi/tengah kotak GABUNGAN ini, bukan per-kartu,
 *  supaya grup tetap bergerak sebagai satu kesatuan (sejalan dengan cara
 *  moveMany men-commit-nya sebagai satu langkah). */
function groupVisualBox(members: Member[]): Box {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const m of members) {
    const b = memberVisualBox(m);
    left = Math.min(left, b.x);
    top = Math.min(top, b.y);
    right = Math.max(right, b.x + b.w);
    bottom = Math.max(bottom, b.y + b.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

type Match = SnapCandidatePair & { delta: number };

/** Yang jaraknya paling dekat menang — dipakai menimbang margin (ruang
 *  koordinat mentah) lawan antar-kartu (ruang koordinat visual), dua-duanya
 *  disimpan sebagai |delta| jadi tetap bisa dibandingkan apa adanya
 *  meski dihitung di ruang koordinat berbeda. */
function closer(a: Match | null, b: Match | null): Match | null {
  if (!a) return b;
  if (!b) return a;
  return Math.abs(a.delta) <= Math.abs(b.delta) ? a : b;
}

/** Hasil smart-guide satu frame drag — delta buat posisi TAMPILAN tiap sumbu
 *  (0 kalau tak nge-snap) plus garis guide-nya buat digambar Canvas.tsx.
 *
 *  Dua jenis sasaran, DUA ruang koordinat berbeda — sengaja tak disatukan
 *  jadi satu daftar kandidat, karena maknanya beda:
 *  - Margin kanvas: cuma SATU kandidat per sumbu (tepi kiri/atas MENTAH grup
 *    — `m.curX`/`curY` langsung, kotak POSISI bukan permukaan visual),
 *    dibandingkan ke `CANVAS_MARGIN_X`/`_Y`. Harus kotak posisi mentah biar
 *    konsisten dengan `boardMinCorner`/`moveMany` (dua-duanya baca `el.x`/`y`
 *    apa adanya, bukan +CARD_GUTTER) — kalau dicampur ke kotak visual di
 *    sini, garis & titik snap-nya bakal geser CARD_GUTTER px dari batas
 *    SUNGGUHAN yang ditegakkan kamera. Gak ada kandidat tengah/kanan —
 *    margin cuma berlaku di tepi utama, gak ada "margin kanan/tengah".
 *  - Kartu lain (`cardAlignPairs`, geometry.ts): TIGA kandidat kiri/tengah/
 *    kanan (atau atas/tengah/bawah) dari kotak VISUAL grup, semuanya
 *    "bergerak" (drag menggeser grup utuh) — beda dari resize yang cuma
 *    tepi kanan/bawah yang gerak, lihat ResizeHandle.tsx.
 *  Yang menang keseluruhan = yang jaraknya paling dekat, apa pun jenisnya. */
function computeGroupSnap(
  drag: { members: Member[]; otherBoxes: Box[] },
  zoom: number
): {
  snapX: number;
  snapY: number;
  guideX: GuideLine | null;
  guideY: GuideLine | null;
  measureX: GapMeasure | null;
  measureY: GapMeasure | null;
} {
  const zone = SNAP_ZONE_PX / zoom;
  const adjacentZone = ADJACENT_SNAP_ZONE_PX / zoom;

  const rawLeft = Math.min(...drag.members.map((m) => m.curX));
  const rawTop = Math.min(...drag.members.map((m) => m.curY));
  const marginMatchX = bestSnapPair([{ candidateValue: rawLeft, targetValue: CANVAS_MARGIN_X, zone }]);
  const marginMatchY = bestSnapPair([{ candidateValue: rawTop, targetValue: CANVAS_MARGIN_Y, zone }]);

  const group = groupVisualBox(drag.members);
  const cardMatchX = bestSnapPair(
    cardAlignPairs(
      group.x, group.x + group.w / 2, group.x + group.w,
      group.y, group.y + group.h,
      drag.otherBoxes, "x", zone, adjacentZone
    )
  );
  const cardMatchY = bestSnapPair(
    cardAlignPairs(
      group.y, group.y + group.h / 2, group.y + group.h,
      group.x, group.x + group.w,
      drag.otherBoxes, "y", zone, adjacentZone
    )
  );

  const matchX = closer(marginMatchX, cardMatchX);
  const matchY = closer(marginMatchY, cardMatchY);
  const snapX = matchX?.delta ?? 0;
  const snapY = matchY?.delta ?? 0;

  // Label jarak hidup (permintaan pemilik: "ukuran px ke card terdekatnya")
  // — dihitung dari kotak grup SETELAH smart-guide di atas (posisi yang
  // BENAR-BENAR dirender), independen dari status snap: tampil tiap ada
  // tetangga "berhadapan", bukan cuma pas match ketemu (lihat nearestGapMeasure).
  const snappedGroup: Box = { ...group, x: group.x + snapX, y: group.y + snapY };
  const measureX = nearestGapMeasure(snappedGroup, drag.otherBoxes, "x");
  const measureY = nearestGapMeasure(snappedGroup, drag.otherBoxes, "y");

  return {
    snapX,
    snapY,
    guideX: guideLineFor(matchX, group, "x"),
    guideY: guideLineFor(matchY, group, "y"),
    measureX,
    measureY,
  };
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
    otherBoxes: Box[];
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
    const groupIdSet = new Set(groupIds);
    const members: Member[] = groupIds
      .map((id) => st.elements[id])
      .filter((el): el is CardElement => !!el && el.type !== "CONNECTOR")
      .map((el) => ({
        id: el.id,
        startX: el.x,
        startY: el.y,
        curX: el.x,
        curY: el.y,
        width: el.width,
        node: document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`),
      }));

    // Kotak visual kartu LAIN (bukan grup ini) di papan yang sama — dihitung
    // SEKALI di sini, bukan tiap frame pointermove: kartu-kartu itu diam
    // selama drag ini berlangsung (satu-satunya yang bergerak ya grup ini),
    // jadi kotaknya tak pernah berubah sampai drag selesai. Menghindari
    // pemindaian + offsetHeight (memaksa layout) atas SEMUA kartu papan tiap
    // frame — itu satu-satunya sumber "kartu lain" buat smart-guide antar-kartu.
    const otherBoxes: Box[] = Object.values(st.elements)
      .filter(
        (el): el is CardElement =>
          el.type !== "CONNECTOR" && el.boardId === st.currentBoardId && !groupIdSet.has(el.id)
      )
      .map((el) => cardVisualBox(el, document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`), MIN_CARD_HEIGHT));

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      members,
      otherBoxes,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const justStarted = !drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD;
    if (!drag.moved && !justStarted) return;
    drag.moved = true;
    const { zoom } = useCanvasStore.getState().camera;
    for (const m of drag.members) {
      m.curX = m.startX + dx / zoom;
      m.curY = m.startY + dy / zoom;
    }

    // Smart-guide (lihat computeGroupSnap) — dipakai murni buat POSISI
    // TAMPILAN (dispX/dispY); m.curX/curY sendiri tetap posisi MENTAH tanpa
    // snap, supaya begitu ditarik keluar jangkauan snap, gerakan lanjut
    // mulus dari sana (bukan "loncat" dari titik yang sempat nempel).
    const { snapX, snapY, guideX, guideY, measureX, measureY } = computeGroupSnap(drag, zoom);

    for (const m of drag.members) {
      const dispX = m.curX + snapX;
      const dispY = m.curY + snapY;
      const node = m.node ?? (m.id === element.id ? rootRef.current : null);
      if (node) {
        // "Terangkat": class ditambah sekali saat gerak melewati ambang, CSS yang
        // mengurus transisi scale/shadow — left/top tetap ditulis instan tiap
        // frame (tanpa transisi) supaya kartu tak lag mengikuti kursor.
        if (justStarted) node.classList.add("is-dragging");
        node.style.left = `${dispX}px`;
        node.style.top = `${dispY}px`;
      }
      canvasBus.emitMove(m.id, dispX, dispY);
    }
    canvasBus.emitGuideLines(guideX, guideY);
    canvasBus.emitGapMeasures(measureX, measureY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    canvasBus.emitGuideLines(null, null);
    canvasBus.emitGapMeasures(null, null);
    if (drag.moved) {
      // Posisi final = mentah + smart-guide TERAKHIR yang aktif (kalau lagi
      // nempel begitu dilepas, itu yang harus di-commit — bukan posisi
      // mentah sebelum snap, biar "yang kelihatan itu yang kesimpan").
      const { zoom } = useCanvasStore.getState().camera;
      const { snapX, snapY } = computeGroupSnap(drag, zoom);

      // Snap ke grid sekali saat dilepas (bukan tiap frame — biar tak "lengket"
      // selagi digeser), di atas hasil smart-guide di atas (kalau nempel di
      // margin, CANVAS_MARGIN_X/_Y sama-sama kelipatan GRID — 20=2×GRID,
      // 60=6×GRID — jadi tak konflik; kalau nempel ke kartu lain, posisi
      // kartu itu sendiri sudah kelipatan GRID juga karena pernah nge-commit
      // lewat jalur yang sama). Tulis ke DOM dulu supaya tak ada kedipan
      // menunggu render berikutnya, baru commit ke store.
      for (const m of drag.members) {
        m.curX = snap(m.curX + snapX);
        m.curY = snap(m.curY + snapY);
        const node = m.node ?? (m.id === element.id ? rootRef.current : null);
        if (node) {
          node.classList.remove("is-dragging");
          node.style.left = `${m.curX}px`;
          node.style.top = `${m.curY}px`;
        }
      }
      moveMany(drag.members.map((m) => ({ id: m.id, x: m.curX, y: m.curY })));
      for (const m of drag.members) canvasBus.emitMoveEnd(m.id);
    }
  };

  /** true kalau pointer barusan benar-benar digeser — dipakai untuk membedakan
   *  klik dari akhir sebuah drag. */
  const wasDragged = () => dragRef.current?.moved ?? false;

  return { rootRef, wasDragged, dragHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}
