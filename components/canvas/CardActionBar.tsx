"use client";

import { undo } from "@/lib/history";
import { useCanvasStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useUiStore } from "@/lib/ui";
import type { CardElement } from "@/lib/types";

/** Bilah aksi kecil di atas kartu yang sedang terpilih (tunggal). Membuka aksi
 *  utama yang tadinya tersembunyi di double-click/tooltip — penting di layar
 *  sentuh yang tak punya hover. Muncul hanya saat kartu ini satu-satunya yang
 *  terpilih & tidak sedang diedit. */
export function CardActionBar({ element }: { element: CardElement }) {
  const sole = useCanvasStore(
    (s) => s.selectedIds.length === 1 && s.selectedIds[0] === element.id
  );
  const editingThis = useCanvasStore((s) => s.editingId === element.id);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const openBoard = useCanvasStore((s) => s.openBoard);
  const removeElement = useCanvasStore((s) => s.removeElement);
  const openDatabase = useUiStore((s) => s.openDatabase);

  if (!sole || editingThis) return null;

  const del = () => {
    removeElement(element.id);
    toast("Kartu dihapus", { actionLabel: "Urungkan", onAction: undo });
  };

  // Aksi utama per tipe (selain hapus, yang selalu ada).
  let primary: { label: string; title: string; onClick: () => void } | null = null;
  if (element.type === "NOTE") {
    primary = { label: "✎", title: "Edit catatan", onClick: () => setEditing(element.id) };
  } else if (element.type === "BOARD_REF") {
    primary = { label: "↗", title: "Buka papan", onClick: () => openBoard(element.content.boardId) };
  } else if (element.type === "DATABASE_REF") {
    primary = { label: "↗", title: "Buka tabel", onClick: () => openDatabase(element.content.databaseId) };
  } else if (element.type === "LINK" && element.content.state === "ready") {
    primary = {
      label: "↗",
      title: "Buka tautan",
      onClick: () => window.open(element.content.url, "_blank", "noopener,noreferrer"),
    };
  }

  return (
    <div
      // Jangan biарkan interaksi bilah ini memicu drag/deselect kartunya.
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute -top-9 left-0 z-20 flex items-center gap-0.5 rounded-md bg-white/95 p-0.5 text-neutral-600 shadow-md ring-1 ring-neutral-200 backdrop-blur"
    >
      {primary && (
        <button
          onClick={primary.onClick}
          title={primary.title}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-100 hover:text-neutral-900"
        >
          {primary.label}
        </button>
      )}
      <button
        onClick={del}
        title="Hapus kartu"
        className="rounded px-2 py-1 text-sm hover:bg-red-50 hover:text-red-600"
      >
        🗑
      </button>
    </div>
  );
}
