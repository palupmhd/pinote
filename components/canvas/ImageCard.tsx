"use client";

import { memo } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { ImageElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { ResizeHandle } from "./ResizeHandle";

function ImageCardBase({ element }: { element: ImageElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const { rootRef, dragHandlers } = useElementDrag(element);

  const { src, naturalWidth, naturalHeight } = element.content;

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab overflow-hidden rounded-md bg-white shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-indigo-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
    >
      <ConnectHandle element={element} />
      {/* Tanpa contentRef — root ini SENDIRI target tinggi resize (sudah
          overflow-hidden buat rounded corner, jadi aman dijadikan bingkai
          crop juga, beda dari kartu teks yang butuh wrapper overflow-y). */}
      <ResizeHandle element={element} rootRef={rootRef} />
      <CardActionBar element={element} />
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL lokal;
          next/image tak relevan untuk gambar yang sudah tertanam & dikecilkan */}
      <img
        src={src}
        // Gambar yang diimpor user = konten, bukan dekorasi → beri alt bermakna
        // supaya tidak dilewati screen reader. (Caption yang bisa diedit: nanti.)
        alt="Gambar terlampir"
        draggable={false}
        // Belum pernah di-resize tinggi (element.height unset): aspect-ratio
        // asli, tinggi ikut lebar otomatis lewat CSS (nol re-render pas
        // resize lebar). Sudah pernah (element.height diset): isi penuh
        // bingkai yang kini tingginya independen, di-crop via object-cover
        // (bukan digepengkan) — supaya foto tak distorsi saat lebar & tinggi
        // diubah dengan rasio berbeda dari aslinya.
        style={{
          width: "100%",
          height: element.height ? "100%" : undefined,
          aspectRatio: element.height ? undefined : `${naturalWidth} / ${naturalHeight}`,
          display: "block",
        }}
        className="select-none bg-neutral-100 object-cover"
      />
    </div>
  );
}

export const ImageCard = memo(ImageCardBase);
