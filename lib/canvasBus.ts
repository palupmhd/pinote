import type { Point } from "./geometry";

/** Kanal imperatif antara drag kartu dan lapisan konektor.
 *
 *  Kartu digeser langsung lewat DOM tanpa update store tiap frame (lihat
 *  useElementDrag), jadi konektor tidak bisa ikut bergerak lewat re-render.
 *  Bus ini yang memberitahu ConnectorLayer posisi terbaru supaya ia bisa
 *  menggambar ulang garisnya sendiri — tetap nol re-render React. */

type MoveHandler = (elementId: string, x: number, y: number) => void;
type MoveEndHandler = (elementId: string) => void;
type GhostHandler = (from: Point | null, to: Point | null) => void;

let onMove: MoveHandler | null = null;
let onMoveEnd: MoveEndHandler | null = null;
let onGhost: GhostHandler | null = null;

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
};
