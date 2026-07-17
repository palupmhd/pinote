"use client";

import { useCallback, useEffect, useRef } from "react";
import { canvasBus } from "@/lib/canvasBus";
import { connectorPath, curveBetween, type Point } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import type { Box, CardElement, ConnectorElement } from "@/lib/types";

const FALLBACK_HEIGHT = 64;

interface Props {
  connectors: ConnectorElement[];
  cards: CardElement[];
}

export function ConnectorLayer({ connectors, cards }: Props) {
  const pathRefs = useRef(new Map<string, SVGPathElement | null>());
  const ghostRef = useRef<SVGPathElement>(null);
  // posisi sementara saat kartu sedang digeser (store belum di-update)
  const livePos = useRef(new Map<string, Point>());
  const removeConnector = useCanvasStore((s) => s.removeElement);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const connectorsRef = useRef(connectors);
  connectorsRef.current = connectors;

  /** Tinggi kartu tidak ada di data model (tinggi mengikuti isi), jadi diukur
   *  dari DOM. Lebar & posisi dari store, ditimpa posisi live saat digeser. */
  const boxOf = useCallback((el: CardElement): Box => {
    const node = document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    const live = livePos.current.get(el.id);
    return {
      x: live?.x ?? el.x,
      y: live?.y ?? el.y,
      w: el.width,
      h: node?.offsetHeight ?? FALLBACK_HEIGHT,
    };
  }, []);

  const redraw = useCallback(
    (onlyTouching?: string) => {
      const byId = new Map(cardsRef.current.map((c) => [c.id, c]));
      for (const c of connectorsRef.current) {
        if (
          onlyTouching &&
          c.sourceElementId !== onlyTouching &&
          c.targetElementId !== onlyTouching
        ) {
          continue;
        }
        const path = pathRefs.current.get(c.id);
        const s = byId.get(c.sourceElementId);
        const t = byId.get(c.targetElementId);
        if (!path || !s || !t) continue;
        path.setAttribute("d", connectorPath(boxOf(s), boxOf(t)));
      }
    },
    [boxOf]
  );

  // Gambar ulang saat data berubah (tambah/hapus/pindah papan/commit drag)
  useEffect(() => {
    redraw();
  }, [redraw, connectors, cards]);

  // Ikut bergerak saat kartu digeser — tanpa re-render React
  useEffect(() => {
    canvasBus.setMoveHandler((id, x, y) => {
      livePos.current.set(id, { x, y });
      redraw(id);
    });
    canvasBus.setMoveEndHandler((id) => {
      livePos.current.delete(id); // posisi sebenarnya sudah ada di store
    });
    canvasBus.setGhostHandler((from, to) => {
      const g = ghostRef.current;
      if (!g) return;
      if (!from || !to) {
        g.setAttribute("d", "");
        return;
      }
      g.setAttribute("d", curveBetween(from, to));
    });
    return () => {
      canvasBus.setMoveHandler(null);
      canvasBus.setMoveEndHandler(null);
      canvasBus.setGhostHandler(null);
    };
  }, [redraw]);

  return (
    // width/height 0 + overflow visible: koordinat SVG = koordinat world,
    // tanpa perlu kotak raksasa yang boros dirasterisasi.
    <svg width="0" height="0" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <marker
          id="conn-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
        </marker>
      </defs>

      {connectors.map((c) => (
        <path
          key={c.id}
          ref={(el) => {
            pathRefs.current.set(c.id, el);
          }}
          fill="none"
          stroke="#a1a1aa"
          strokeWidth={2}
          markerEnd="url(#conn-arrow)"
          className="pointer-events-auto cursor-pointer hover:stroke-red-400"
          style={{ strokeLinecap: "round" }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            removeConnector(c.id); // klik dua kali garis = hapus
          }}
        >
          <title>Klik dua kali untuk hapus garis</title>
        </path>
      ))}

      <path
        ref={ghostRef}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={2}
        strokeDasharray="4 4"
        markerEnd="url(#conn-arrow)"
        className="pointer-events-none"
      />
    </svg>
  );
}
