"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Popover mengambang, di-portal ke document.body dengan posisi FIXED yang
 *  dihitung dari getBoundingClientRect() trigger-nya — bukan position:absolute
 *  biasa. Perlu karena beberapa trigger (header kolom & sel relasi TableBoard)
 *  hidup di dalam kontainer overflow-auto: satu sumbu non-visible memaksa
 *  sumbu lain jadi non-visible juga (kuirk CSS), jadi popover absolute yang
 *  harusnya melayang di atas malah ikut terpotong begitu tabelnya discroll —
 *  pola sama yang sudah diperbaiki di Toolbar.tsx untuk menu "Lainnya".
 *
 *  Tertutup lewat klik-luar atau Escape. */
export function FloatingPopover({
  anchorRef,
  open,
  onClose,
  children,
  align = "start",
  width = 224,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "start" = rata kiri ke anchor; "end" = rata kanan (dipakai saat anchor
   *  dekat tepi kanan, mis. tombol "+ tambah kolom" di ujung header). */
  align?: "start" | "end";
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const rawLeft = align === "end" ? r.right - width : r.left;
      // Jepit ke dalam viewport — popover di dekat tepi kanan/kiri layar tak
      // boleh terpotong atau nongol sebagian di luar jendela.
      const left = Math.min(Math.max(8, rawLeft), window.innerWidth - width - 8);
      setPos({ top: r.bottom + 4, left });
    };
    place();
    let raf = 0;
    const scheduled = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    window.addEventListener("resize", scheduled);
    window.addEventListener("scroll", scheduled, true);
    return () => {
      window.removeEventListener("resize", scheduled);
      window.removeEventListener("scroll", scheduled, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, anchorRef, align, width]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={panelRef}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", top: pos.top, left: pos.left, width }}
      className="z-50 max-h-[70vh] overflow-y-auto rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-neutral-200"
    >
      {children}
    </div>,
    document.body
  );
}
