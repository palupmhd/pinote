"use client";

import { redo, undo, useHistoryStore } from "@/lib/history";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import { INBOX_BOARD_ID } from "@/lib/types";
import { Breadcrumb } from "./Breadcrumb";
import { SyncStatus } from "./SyncStatus";
import { IconAgenda, IconInbox, IconRedo, IconSearch, IconUndo } from "./icons";

function BarButton({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        disabled
          ? "text-neutral-300"
          : active
            ? "bg-indigo-50 text-indigo-600"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Chrome atas (gaya mockup): kiri = workspace + breadcrumb, tengah = search,
 *  kanan = aksi cepat (Inbox/Agenda/Undo/Redo) + status sync. Strip transparan;
 *  hanya pil-nya yang menangkap pointer supaya kanvas di baliknya tetap bisa
 *  di-pan. */
export function TopBar() {
  const openSearch = useUiStore((s) => s.openSearch);
  const toggleAgenda = useUiStore((s) => s.toggleAgenda);
  const agendaOpen = useUiStore((s) => s.agendaOpen);
  const openBoard = useCanvasStore((s) => s.openBoard);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-3 py-2.5">
      {/* Kiri: workspace + breadcrumb */}
      <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-xl bg-white/90 py-1 pl-1.5 pr-2.5 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-[11px] font-bold text-white">
          S
        </span>
        <Breadcrumb />
      </div>

      {/* Tengah: search */}
      <div className="flex flex-1 justify-center">
        <button
          onClick={openSearch}
          className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-400 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:ring-neutral-300"
        >
          <IconSearch className="h-4 w-4" />
          <span className="flex-1 text-left">Cari apa saja…</span>
          <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">⌘K</kbd>
        </button>
      </div>

      {/* Kanan: aksi cepat + sync */}
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-white/90 px-1 py-1 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <BarButton
          title="Inbox — tangkapan cepat (Ctrl/Cmd+I)"
          active={currentBoardId === INBOX_BOARD_ID}
          onClick={() => openBoard(INBOX_BOARD_ID)}
        >
          <IconInbox />
        </BarButton>
        <BarButton title="Agenda — semua tugas bertenggat" active={agendaOpen} onClick={toggleAgenda}>
          <IconAgenda />
        </BarButton>
        <span className="mx-0.5 h-5 w-px bg-neutral-200" />
        <BarButton title="Urungkan (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}>
          <IconUndo />
        </BarButton>
        <BarButton title="Ulangi (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <IconRedo />
        </BarButton>
        <span className="mx-0.5 h-5 w-px bg-neutral-200" />
        <SyncStatus />
      </div>
    </div>
  );
}
