"use client";

import type { RefObject } from "react";
import { useCanvasStore } from "@/lib/store";
import type { Camera } from "@/lib/types";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  cameraRef: RefObject<Camera>;
}

/** Toolbar kiri. Elemen baru diletakkan di tengah viewport papan yang sedang
 *  dibuka (dihitung dari kamera "hidup", bukan dari state). */
export function Toolbar({ containerRef, cameraRef }: Props) {
  const addNote = useCanvasStore((s) => s.addNote);
  const addBoard = useCanvasStore((s) => s.addBoard);

  const viewportCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    return { x: (cx - cam.x) / cam.zoom, y: (cy - cam.y) / cam.zoom };
  };

  const tools = [
    { label: "Catatan", hint: "Tambah catatan", onClick: () => {
        const { x, y } = viewportCenter();
        addNote(x, y);
      } },
    { label: "Papan", hint: "Tambah papan (bisa dibuka jadi kanvas sendiri)", onClick: () => {
        const { x, y } = viewportCenter();
        addBoard(x, y);
      } },
  ];

  return (
    <div className="pointer-events-auto absolute left-3 top-16 z-10 flex flex-col gap-1 rounded-md bg-white/90 p-1.5 shadow-sm ring-1 ring-neutral-200 backdrop-blur">
      {tools.map((t) => (
        <button
          key={t.label}
          onClick={t.onClick}
          title={t.hint}
          className="rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
        >
          + {t.label}
        </button>
      ))}
    </div>
  );
}
