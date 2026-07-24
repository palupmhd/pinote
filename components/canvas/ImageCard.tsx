"use client";

import { memo } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { ImageElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { CardHeader } from "./CardHeader";
import { ConnectHandle } from "./ConnectHandle";
import { IconImage } from "./icons";

function ImageCardBase({ element }: { element: ImageElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const { rootRef, dragHandlers } = useElementDrag(element);

  const { src, naturalWidth, naturalHeight } = element.content;
  const height = (element.width * naturalHeight) / naturalWidth;

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab overflow-hidden rounded-xl bg-white shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-indigo-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
    >
      <ConnectHandle element={element} />
      <CardActionBar element={element} />
      <CardHeader icon={<IconImage className="h-3.5 w-3.5" />} label="Gambar" />
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL lokal;
          next/image tak relevan untuk gambar yang sudah tertanam & dikecilkan */}
      <img
        src={src}
        // Gambar yang diimpor user = konten, bukan dekorasi → beri alt bermakna
        // supaya tidak dilewati screen reader. (Caption yang bisa diedit: nanti.)
        alt="Gambar terlampir"
        draggable={false}
        style={{ width: "100%", height, display: "block" }}
        className="select-none bg-neutral-100 object-cover"
      />
    </div>
  );
}

export const ImageCard = memo(ImageCardBase);
