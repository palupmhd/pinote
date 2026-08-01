import type { GapMeasure, GuideLine, Point } from "./geometry";
export type { GapMeasure, GuideLine } from "./geometry";

/** Kanal imperatif antara drag kartu dan lapisan konektor.
 *
 *  Kartu digeser langsung lewat DOM tanpa update store tiap frame (lihat
 *  useElementDrag), jadi konektor tidak bisa ikut bergerak lewat re-render.
 *  Bus ini yang memberitahu ConnectorLayer posisi terbaru supaya ia bisa
 *  menggambar ulang garisnya sendiri — tetap nol re-render React. */

type MoveHandler = (elementId: string, x: number, y: number) => void;
type MoveEndHandler = (elementId: string) => void;
type GhostHandler = (from: Point | null, to: Point | null) => void;
// GuideLine (bentuk pesan smart-guide, dunia) didefinisikan di geometry.ts
// bareng cardAlignPairs/guideLineFor yang membangunnya — cuma satu garis per
// sumbu (yang menang di pencarian match terdekat, lihat useElementDrag.ts &
// ResizeHandle.tsx), jadi margin dan antar-kartu tak pernah tampil bareng.
type GuideLineHandler = (x: GuideLine | null, y: GuideLine | null) => void;
// GapMeasure (geometry.ts) — BEDA dari GuideLine: bukan soal snap, murni
// pengukuran jarak ke tetangga terdekat, selalu aktif tiap ada tetangga yang
// relevan (bukan cuma dalam jangkauan SNAP_ZONE_PX). Dipisah dari kanal
// guide-line supaya label jarak bisa tampil independen dari status snap.
type GapMeasureHandler = (x: GapMeasure | null, y: GapMeasure | null) => void;

let onMove: MoveHandler | null = null;
let onMoveEnd: MoveEndHandler | null = null;
let onGhost: GhostHandler | null = null;
let onGuideLines: GuideLineHandler | null = null;
let onGapMeasures: GapMeasureHandler | null = null;

export const canvasBus = {
  setMoveHandler(fn: MoveHandler | null) {
    onMove = fn;
  },
  setMoveEndHandler(fn: MoveEndHandler | null) {
    onMoveEnd = fn;
  },
  setGhostHandler(fn: GhostHandler | null) {
    onGhost = fn;
  },
  setGuideLineHandler(fn: GuideLineHandler | null) {
    onGuideLines = fn;
  },
  setGapMeasureHandler(fn: GapMeasureHandler | null) {
    onGapMeasures = fn;
  },
  /** dipanggil tiap frame saat kartu digeser */
  emitMove(elementId: string, x: number, y: number) {
    onMove?.(elementId, x, y);
  },
  /** drag selesai — posisi sebenarnya sudah masuk store */
  emitMoveEnd(elementId: string) {
    onMoveEnd?.(elementId);
  },
  /** garis bayangan saat menarik konektor baru; (null, null) = sembunyikan */
  emitGhost(from: Point | null, to: Point | null) {
    onGhost?.(from, to);
  },
  /** Smart-guide aktif SEKARANG per sumbu (margin kanvas ATAU kartu lain,
   *  lihat GuideLine) — dipanggil tiap frame drag. null = sumbu itu tak
   *  sedang nge-snap ke apa pun, sembunyikan garisnya. */
  emitGuideLines(x: GuideLine | null, y: GuideLine | null) {
    onGuideLines?.(x, y);
  },
  /** Jarak hidup ke tetangga terdekat per sumbu (lihat GapMeasure) — dipanggil
   *  tiap frame drag/resize. null = tak ada tetangga "berhadapan" di sumbu
   *  itu, sembunyikan labelnya. */
  emitGapMeasures(x: GapMeasure | null, y: GapMeasure | null) {
    onGapMeasures?.(x, y);
  },
};
