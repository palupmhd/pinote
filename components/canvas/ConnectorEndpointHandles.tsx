"use client";

import { canvasBus } from "@/lib/canvasBus";
import {
  CONNECTOR_ANCHORS,
  anchorPoint,
  cardVisualBox,
  nearestAnchor,
  resolveConnectorEndpoints,
  type Point,
} from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import type { Box, CardElement, ConnectorAnchor } from "@/lib/types";

const FALLBACK_HEIGHT = 64;

const boxOf = (el: CardElement): Box => {
  const node = document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
  return cardVisualBox(el, node, FALLBACK_HEIGHT);
};

const toWorld = (clientX: number, clientY: number): Point => {
  const world = document.getElementById("world-layer");
  const rect = world?.getBoundingClientRect();
  const { zoom } = useCanvasStore.getState().camera;
  return { x: (clientX - (rect?.left ?? 0)) / zoom, y: (clientY - (rect?.top ?? 0)) / zoom };
};

/** Kartu (bukan konektor) yang ada persis di bawah kursor SUNGGUHAN
 *  (`elementFromPoint`, koordinat layar) — dipakai cari tujuan seret ujung
 *  konektor, sama caranya dengan ConnectHandle.tsx bikin konektor baru. */
const cardUnderPoint = (clientX: number, clientY: number): CardElement | null => {
  const under = document.elementFromPoint(clientX, clientY);
  const id = under?.closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
  const el = id ? useCanvasStore.getState().elements[id] : null;
  return el && el.type !== "CONNECTOR" ? el : null;
};

/** 8 titik snap (dot pasif) + 2 handle yang bisa diseret, buat konektor yang
 *  SEDANG DIPILIH (trigger sama dengan ConnectorPopover: klik garisnya).
 *
 *  Dirender sebagai SAUDARA kartu di Canvas.tsx (setelah `cards.map(...)`,
 *  BUKAN di dalam ConnectorLayer, yang sengaja digambar SEBELUM kartu
 *  supaya garisnya selalu di bawah) — supaya dot & handle-nya kelihatan &
 *  bisa diklik di ATAS kartu, bukan tertutup olehnya. Tetap anak `#world-layer`
 *  (posisi world lewat `left`/`top` mentah) supaya ikut pan/zoom otomatis,
 *  gaya yang sama dengan ResizeHandle/ConnectHandle.
 *
 *  Seret salah satu handle → ghost line (canal `canvasBus` yang sama dipakai
 *  ConnectHandle bikin konektor baru) mengikuti kursor, nge-snap ke salah
 *  satu 8 titik kartu APA PUN yang ada di bawah kursor (termasuk kartu lain
 *  di luar source/target aslinya — re-target sekalian, sesuai permintaan
 *  pemilik). Lepas di kartu manapun → `updateConnectorEndpoint` memaku ujung
 *  itu ke titik tersebut; lepas di kanvas kosong → tak ada perubahan.
 *
 *  BEDA dari ResizeHandle/ConnectHandle: gerakan mouse selama drag ditangani
 *  lewat listener di `window` (dipasang/dilepas imperatif di `startDrag`),
 *  BUKAN `setPointerCapture` + handler React lokal di elemen handle-nya
 *  sendiri. Dilaporkan pemilik dua kali ("panah tidak bisa dipindahkan",
 *  "garis biru tidak bergerak") meski mekanismenya sudah diverifikasi benar
 *  lewat simulasi — beda paling mencolok dari pola drag LAIN yang sudah
 *  terbukti jalan (ResizeHandle/ConnectHandle/useElementDrag, semua pakai
 *  setPointerCapture): elemen handle di sini letaknya berpindah-pindah &
 *  MUNCUL/HILANG mengikuti state seleksi (`editingConnectorId`), bukan
 *  elemen tetap yang selalu ada seperti pada ketiganya. Kalau render ulang
 *  APAPUN sempat membuat kondisi guard di atas (`if (!connector...)`)
 *  balik jadi true sesaat, komponen ini unmount — pointer capture yang
 *  nempel di elemen yang hilang otomatis batal (device browser memicu
 *  lostpointercapture), memutus drag di tengah jalan tanpa jejak error.
 *  Listener `window` tidak punya masalah ini: window tidak pernah unmount,
 *  jadi gerakan mouse tetap tertangkap sampai pointerup sungguhan, apapun
 *  yang terjadi ke elemen handle-nya sendiri selama itu. */
export function ConnectorEndpointHandles() {
  const editingConnectorId = useUiStore((s) => s.editingConnectorId);
  const connector = useCanvasStore((s) => {
    const el = editingConnectorId ? s.elements[editingConnectorId] : null;
    return el && el.type === "CONNECTOR" ? el : null;
  });
  const source = useCanvasStore((s) => (connector ? s.elements[connector.sourceElementId] : null));
  const target = useCanvasStore((s) => (connector ? s.elements[connector.targetElementId] : null));
  const updateConnectorEndpoint = useCanvasStore((s) => s.updateConnectorEndpoint);

  if (!connector || !source || !target || source.type === "CONNECTOR" || target.type === "CONNECTOR") return null;

  const sBox = boxOf(source);
  const tBox = boxOf(target);
  const { a, b } = resolveConnectorEndpoints(sBox, tBox, connector.sourceAnchor, connector.targetAnchor);
  const connectorId = connector.id;

  const startDrag = (end: "source" | "target", e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // jangan buka drag kartu / nutup popover via listener "klik luar"
    e.preventDefault(); // cegah drag/seleksi teks bawaan browser ikut nyala

    const pointerId = e.pointerId;
    const fixed = end === "source" ? b : a;
    let pending: { elementId: string; anchor: ConnectorAnchor } | null = null;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const card = cardUnderPoint(ev.clientX, ev.clientY);
      if (card) {
        const box = boxOf(card);
        const anchor = nearestAnchor(box, toWorld(ev.clientX, ev.clientY));
        pending = { elementId: card.id, anchor };
        canvasBus.emitGhost(fixed, anchorPoint(box, anchor));
      } else {
        pending = null;
        canvasBus.emitGhost(fixed, toWorld(ev.clientX, ev.clientY));
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      canvasBus.emitGhost(null, null);
      if (pending) updateConnectorEndpoint(connectorId, end, pending.elementId, pending.anchor);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      canvasBus.emitGhost(null, null);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    canvasBus.emitGhost(fixed, toWorld(e.clientX, e.clientY));
  };
  const onSourcePointerDown = (e: React.PointerEvent) => startDrag("source", e);
  const onTargetPointerDown = (e: React.PointerEvent) => startDrag("target", e);

  const dots = (box: Box) =>
    CONNECTOR_ANCHORS.map((anchor) => {
      const p = anchorPoint(box, anchor);
      return (
        <div
          key={anchor}
          className="pointer-events-none absolute z-20 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-400/70 ring-1 ring-white"
          style={{ left: p.x, top: p.y }}
        />
      );
    });

  return (
    <>
      {dots(sBox)}
      {dots(tBox)}
      {/* z-20: WAJIB lebih tinggi dari ResizeHandle/ConnectHandle (z-10) &
          CardActionBar (z-20 juga, kalah lewat urutan DOM — komponen ini
          dirender belakangan) — lihat komentar panjang di atas fungsi ini
          soal kenapa gerakan mouse ditangkap lewat window, bukan capture. */}
      <div
        onPointerDown={onSourcePointerDown}
        title="Seret untuk pindah titik awal"
        className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none items-center justify-center"
        style={{ left: a.x, top: a.y }}
      >
        <span className="pointer-events-none h-4 w-4 rounded-full border-2 border-white bg-forest-400 shadow" />
      </div>
      <div
        onPointerDown={onTargetPointerDown}
        title="Seret untuk pindah titik akhir"
        className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none items-center justify-center"
        style={{ left: b.x, top: b.y }}
      >
        <span className="pointer-events-none h-4 w-4 rounded-full border-2 border-white bg-forest-400 shadow" />
      </div>
    </>
  );
}
