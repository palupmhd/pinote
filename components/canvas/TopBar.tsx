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
    // Layar sempit: kiri+kanan di baris 1 (ml-auto mendorong kanan ke tepi),
    // search jadi baris 2 penuh-lebar (flex-wrap + w-full memaksa wrap) — pola
    // sama dengan header DatabaseView. sm+: satu baris seperti semula. Tanpa
    // ini, cluster kanan (Inbox/Agenda/Undo/Redo/Sync) terpotong tak terjangkau
    // di layar <640px (dikonfirmasi: meluber ~97px melewati tepi viewport).
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap sm:gap-3">
      {/* Kiri: workspace + breadcrumb */}
      <div className="pointer-events-auto order-1 flex min-w-0 items-center gap-2 rounded-xl bg-white/90 py-1 pl-1.5 pr-2.5 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-[11px] font-bold text-white">
          S
        </span>
        <Breadcrumb />
      </div>

      {/* Kanan: aksi cepat + sync — baris 1 di mobile (didorong ke tepi kanan
          lewat ml-auto), balik ke urutan normal (setelah search) di sm+. */}
      <div className="pointer-events-auto order-2 ml-auto flex items-center gap-0.5 rounded-xl bg-white/90 px-1 py-1 shadow-sm ring-1 ring-black/5 backdrop-blur sm:order-3 sm:ml-0">
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

      {/* Tengah: search — baris 2 penuh-lebar di mobile (w-full memaksa wrap
          ke baris sendiri), jadi tengah fleksibel di antara kiri/kanan di sm+. */}
      <div className="order-3 flex w-full sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
        <button
          onClick={openSearch}
          className="pointer-events-auto flex w-full items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-400 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:ring-neutral-300 sm:max-w-md"
        >
          <IconSearch className="h-4 w-4" />
          <span className="flex-1 text-left">Cari apa saja…</span>
          <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}
