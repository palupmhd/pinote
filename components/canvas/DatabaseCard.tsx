"use client";

import { memo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import { useElementDrag } from "@/lib/useElementDrag";
import { useSnapAutoHeight } from "@/lib/useSnapAutoHeight";
import { CARD_GUTTER, DATABASE_VIEW_DEFAULTS } from "@/lib/types";
import type { DatabaseRefElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { DatabaseViewPicker } from "./DatabaseViewPicker";
import { ResizeHandle } from "./ResizeHandle";

function DatabaseCardBase({ element }: { element: DatabaseRefElement }) {
  const dbId = element.content.databaseId;
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const title = useCanvasStore((s) => s.databases[dbId]?.title ?? "Database");
  const rows = useCanvasStore((s) => s.databases[dbId]?.rows.length ?? 0);
  const cols = useCanvasStore((s) => s.databases[dbId]?.columns.length ?? 0);
  const openDatabase = useUiStore((s) => s.openDatabase);
  const attachDatabaseView = useCanvasStore((s) => s.attachDatabaseView);

  const { rootRef, wasDragged, dragHandlers } = useElementDrag(element);
  const contentRef = useRef<HTMLDivElement>(null);
  useSnapAutoHeight(contentRef, element.height === undefined);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wasDragged()) openDatabase(dbId);
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
      onDoubleClick={onDoubleClick}
    >
      <div
        className={[
          "relative m-0.5 rounded-md bg-white shadow-sm transition-shadow",
          selected ? "ring-2 ring-forest-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
        ].join(" ")}
      >
        <ConnectHandle element={element} selected={selected} />
        <ResizeHandle element={element} rootRef={rootRef} contentRef={contentRef} selected={selected} />
        <DatabaseViewPicker
          onPick={(view) => {
            // attachDatabaseView MEMUSATKAN kartu baru di titik yang dioper
            // (kedua sumbu) — cocok untuk pemanggil lain (DatabaseView.tsx:
            // titik itu benar-benar pusat viewport). Di sini yang diinginkan
            // beda: kartu-view baru muncul DI SAMPING kartu pintu ini, tepi
            // ATAS-nya sejajar dengan tepi atas kartu pintu — bukan dipusatkan
            // pada tepi atas itu (yang mendorong separuh TINGGI kartu-view ke
            // ATAS kartu pintu, bisa lahir di luar layar kalau kartu pintu
            // dekat tepi atas viewport). Kompensasi: geser titik y yang
            // dioper turun sejumlah setengah tinggi kartu-view, supaya setelah
            // attachDatabaseView memusatkannya, tepi atas hasilnya balik
            // persis ke element.y.
            const dropY = element.y + DATABASE_VIEW_DEFAULTS[view].height / 2;
            attachDatabaseView(dbId, view, element.x + element.width + 30, dropY);
          }}
        />
        <CardActionBar element={element} />
        <div ref={contentRef} className="overflow-y-auto p-3" style={{ height: element.height }}>
          <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {rows} baris · {cols} kolom · klik dua kali untuk buka
          </p>
        </div>
      </div>
    </div>
  );
}

export const DatabaseCard = memo(DatabaseCardBase);
