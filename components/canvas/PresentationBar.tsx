"use client";

import { useUiStore } from "@/lib/ui";

/** Bilah kontrol Presentation Mode: maju/mundur langkah + keluar. Satu-satunya
 *  UI yang tampil saat presentasi (sisanya disembunyikan). */
export function PresentationBar() {
  const index = useUiStore((s) => s.presentIndex);
  const total = useUiStore((s) => s.presentOrder.length);
  const next = useUiStore((s) => s.presentNext);
  const prev = useUiStore((s) => s.presentPrev);
  const exit = useUiStore((s) => s.exitPresentation);

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900/90 px-2 py-1.5 text-sm text-white shadow-lg backdrop-blur">
      <button
        onClick={prev}
        disabled={index === 0}
        title="Sebelumnya (←)"
        className="rounded-full px-3 py-1 hover:bg-white/15 disabled:opacity-30"
      >
        ‹
      </button>
      <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-neutral-300">
        {index + 1} / {total}
      </span>
      <button
        onClick={next}
        disabled={index >= total - 1}
        title="Berikutnya (→ / spasi)"
        className="rounded-full px-3 py-1 hover:bg-white/15 disabled:opacity-30"
      >
        ›
      </button>
      <div className="mx-1 h-4 w-px bg-white/20" />
      <button
        onClick={exit}
        title="Keluar (Esc)"
        className="rounded-full px-3 py-1 text-xs text-neutral-300 hover:bg-white/15 hover:text-white"
      >
        Keluar
      </button>
    </div>
  );
}
