"use client";

import { memo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import { useSnapAutoHeight } from "@/lib/useSnapAutoHeight";
import type { ImageElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { ResizeHandle } from "./ResizeHandle";

function ImageCardBase({ element }: { element: ImageElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const { rootRef, dragHandlers } = useElementDrag(element);
  const contentRef = useRef<HTMLDivElement>(null);
  // Sebelum pernah di-resize manual, tinggi murni ikut aspect-ratio foto
  // (nyaris tak pernah kelipatan GRID) — bulatkan ke atas via padding-bottom
  // sama seperti kartu teks lain, supaya tepi bawahnya tetap jatuh di dot.
  useSnapAutoHeight(contentRef, element.height === undefined);

  const { src, naturalWidth, naturalHeight } = element.content;

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className="group absolute cursor-grab active:cursor-grabbing"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        // Tinggi root SENGAJA tidak diset di sini — root cuma kotak posisi,
        // tingginya otomatis mengikuti bingkai crop di bawah (yang bermargin)
        // persis seperti kartu teks lain (auto-height dari konten + margin).
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
    >
      {/* Bingkai crop (overflow-hidden buat rounded corner) sekaligus permukaan
          visual dengan margin (m-0.5) — jadi target tinggi resize (contentRef),
          beda dari root yang cuma kotak posisi mentah. */}
      <div
        ref={contentRef}
        className={[
          "relative m-0.5 overflow-hidden rounded-md bg-white shadow-sm transition-shadow",
          selected ? "ring-2 ring-forest-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
        ].join(" ")}
        style={{ height: element.height }}
      >
        <ConnectHandle element={element} />
        <ResizeHandle element={element} rootRef={rootRef} contentRef={contentRef} />
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
    </div>
  );
}

export const ImageCard = memo(ImageCardBase);
