"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/types";
import { IconFit, IconMinus, IconPlus } from "./icons";

/** Kontrol zoom di tepi kanan (gaya mockup): +, persentase (klik → 100%), −,
 *  dan tombol layar penuh. Zoom berpusat di tengah viewport. Persentase ikut
 *  kamera store (diperbarui saat gestur selesai). */
export function ZoomControls() {
  const camera = useCanvasStore((s) => s.camera);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const zoomTo = (z2: number) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H / 2;
    const z1 = camera.zoom;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z2));
    const wx = (cx - camera.x) / z1;
    const wy = (cy - camera.y) / z1;
    setCamera({ x: cx - wx * clamped, y: cy - wy * clamped, zoom: clamped });
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl bg-white/95 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.10)] ring-1 ring-black/5 backdrop-blur">
      <button
        onClick={() => zoomTo(camera.zoom * 1.2)}
        title="Perbesar"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <IconPlus className="h-5 w-5" />
      </button>
      <button
        onClick={() => zoomTo(1)}
        title="Setel ke 100%"
        className="w-9 rounded-lg py-0.5 text-center text-[11px] font-medium tabular-nums text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      >
        {Math.round(camera.zoom * 100)}%
      </button>
      <button
        onClick={() => zoomTo(camera.zoom / 1.2)}
        title="Perkecil"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <IconMinus className="h-5 w-5" />
      </button>
      <span className="my-0.5 h-px w-5 bg-neutral-200" />
      <button
        onClick={toggleFull}
        title={isFull ? "Keluar layar penuh" : "Layar penuh"}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <IconFit className="h-5 w-5" />
      </button>
    </div>
  );
}
