"use client";

import { memo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import { useSnapAutoHeight } from "@/lib/useSnapAutoHeight";
import { CARD_GUTTER } from "@/lib/types";
import type { DatabaseViewElement } from "@/lib/types";
import { CalendarBoard } from "./CalendarBoard";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { KanbanBoard } from "./KanbanBoard";
import { ResizeHandle } from "./ResizeHandle";
import { TableBoard } from "./TableBoard";

/** Kartu yang merender SATU tampilan Database langsung di kanvas, read+edit
 *  penuh — beda dari DatabaseCard (kartu pintu ke modal). `view`/`groupBy`/
 *  `dateBy` melekat ke KARTU ini (element.content), bukan ke entitas Database
 *  — jadi banyak kartu boleh menunjuk database yang sama dengan konfigurasi
 *  independen (lihat setDatabaseViewConfig di lib/store.ts). */
function DatabaseViewCardBase({ element }: { element: DatabaseViewElement }) {
  const dbId = element.content.databaseId;
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const db = useCanvasStore((s) => s.databases[dbId]);
  const setDatabaseViewConfig = useCanvasStore((s) => s.setDatabaseViewConfig);
  const openRowAsBoard = useCanvasStore((s) => s.openRowAsBoard);

  const { rootRef, dragHandlers } = useElementDrag(element);
  const contentRef = useRef<HTMLDivElement>(null);
  // BUKAN auto-height: Kanban/Kalender/Tabel semua layout
  // h-full + scroll internal (bukan "tumbuh ikut konten" seperti Note) —
  // attachDatabaseView selalu menyetel `height` eksplisit, jadi selalu
  // nonaktif di sini, bukan digerbang element.height === undefined.
  useSnapAutoHeight(contentRef, false);

  // Buka isi kanvas sebuah baris dari kartu-view ini — tak ada modal untuk
  // ditutup di sini (beda dari DatabaseView.tsx punya modal-nya sendiri).
  const openRowCanvasForCard = (rowId: string) => {
    openRowAsBoard(dbId, rowId);
  };

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className="group absolute cursor-grab active:cursor-grabbing"
      style={{
        left: element.x,
        top: element.y,
        width: element.width + CARD_GUTTER * 2,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
    >
      <div
        className={[
          "relative m-0.5 rounded-md bg-white shadow-sm transition-shadow",
          selected ? "ring-2 ring-forest-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
        ].join(" ")}
      >
        <ConnectHandle element={element} selected={selected} />
        <ResizeHandle element={element} rootRef={rootRef} contentRef={contentRef} selected={selected} />
        <CardActionBar element={element} />
        <div ref={contentRef} className="overflow-hidden" style={{ height: element.height }}>
          {!db ? (
            <p className="p-3 text-xs text-red-400">Database tidak ditemukan</p>
          ) : element.content.view === "kanban" ? (
            <KanbanBoard
              db={db}
              groupBy={element.content.groupBy}
              onGroupByChange={(colId) => setDatabaseViewConfig(element.id, { groupBy: colId })}
            />
          ) : element.content.view === "calendar" ? (
            <CalendarBoard
              db={db}
              dateBy={element.content.dateBy}
              onDateByChange={(colId) => setDatabaseViewConfig(element.id, { dateBy: colId })}
            />
          ) : (
            <TableBoard db={db} onOpenRowCanvas={openRowCanvasForCard} />
          )}
        </div>
      </div>
    </div>
  );
}

export const DatabaseViewCard = memo(DatabaseViewCardBase);
