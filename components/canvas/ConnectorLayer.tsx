"use client";

import { useCallback, useEffect, useRef } from "react";
import { canvasBus } from "@/lib/canvasBus";
import { connectorPath, curveBetween, type Point } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import type { Box, CardElement, ConnectorElement } from "@/lib/types";

const FALLBACK_HEIGHT = 64;
/** Setengah sisi kotak SVG, samakan dengan grid di Canvas. SVG WAJIB punya
 *  ukuran nyata — svg 0x0 (walau overflow:visible) tidak dilukis sama sekali.
 *  Anak-anaknya digeser +EXTENT lewat <g> supaya tetap bisa memakai koordinat
 *  world apa adanya, termasuk yang negatif. */
const EXTENT = 6000;

/** Panah relasi database (spec §8.6): sumber/tujuan tetap id elemen (kartu
 *  database), jadi memakai ulang jalur gambar & ikut-geser yang sama seperti
 *  konektor biasa. Diturunkan dari data, bukan elemen tersimpan. */
export interface RelationArrow {
  id: string;
  sourceElementId: string;
  targetElementId: string;
}

interface Props {
  connectors: ConnectorElement[];
  relations: RelationArrow[];
  cards: CardElement[];
}

export function ConnectorLayer({ connectors, relations, cards }: Props) {
  const pathRefs = useRef(new Map<string, SVGPathElement | null>());
  const relPathRefs = useRef(new Map<string, SVGPathElement | null>());
  const ghostRef = useRef<SVGPathElement>(null);
  // posisi sementara saat kartu sedang digeser (store belum di-update)
  const livePos = useRef(new Map<string, Point>());
  const removeConnector = useCanvasStore((s) => s.removeElement);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const connectorsRef = useRef(connectors);
  connectorsRef.current = connectors;
  const relationsRef = useRef(relations);
  relationsRef.current = relations;

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
      const drawInto = (
        refs: Map<string, SVGPathElement | null>,
        id: string,
        srcId: string,
        tgtId: string
      ) => {
        if (onlyTouching && srcId !== onlyTouching && tgtId !== onlyTouching) return;
        const path = refs.get(id);
        const s = byId.get(srcId);
        const t = byId.get(tgtId);
        if (!path || !s || !t) return;
        path.setAttribute("d", connectorPath(boxOf(s), boxOf(t)));
      };
      for (const c of connectorsRef.current) drawInto(pathRefs.current, c.id, c.sourceElementId, c.targetElementId);
      for (const r of relationsRef.current) drawInto(relPathRefs.current, r.id, r.sourceElementId, r.targetElementId);
    },
    [boxOf]
  );

  // Gambar ulang saat data berubah (tambah/hapus/pindah papan/commit drag)
  useEffect(() => {
    redraw();
  }, [redraw, connectors, relations, cards]);

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
    <svg
      className="pointer-events-none absolute"
      style={{ left: -EXTENT, top: -EXTENT, width: EXTENT * 2, height: EXTENT * 2 }}
    >
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
        <marker
          id="rel-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
        </marker>
      </defs>

      {/* Geser origin ke tengah kotak → anak-anaknya tetap pakai koordinat world */}
      <g transform={`translate(${EXTENT} ${EXTENT})`}>
        {/* Panah relasi database (§8.6): ungu putus-putus, tidak interaktif —
            diturunkan dari data, dihapus dengan melepas tautannya di tabel. */}
        {relations.map((r) => (
          <path
            key={r.id}
            ref={(el) => {
              relPathRefs.current.set(r.id, el);
            }}
            fill="none"
            stroke="#818cf8"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            markerEnd="url(#rel-arrow)"
            style={{ strokeLinecap: "round" }}
          />
        ))}

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
        />
      </g>
    </svg>
  );
}
