"use client";

import { memo } from "react";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import { useElementDrag } from "@/lib/useElementDrag";
import type { DatabaseRefElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { ResizeHandle } from "./ResizeHandle";

function DatabaseCardBase({ element }: { element: DatabaseRefElement }) {
  const dbId = element.content.databaseId;
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const title = useCanvasStore((s) => s.databases[dbId]?.title ?? "Database");
  const rows = useCanvasStore((s) => s.databases[dbId]?.rows.length ?? 0);
  const cols = useCanvasStore((s) => s.databases[dbId]?.columns.length ?? 0);
  const openDatabase = useUiStore((s) => s.openDatabase);

  const { rootRef, wasDragged, dragHandlers } = useElementDrag(element);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wasDragged()) openDatabase(dbId);
  };

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab rounded-md bg-white shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-indigo-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
      onDoubleClick={onDoubleClick}
    >
      <ConnectHandle element={element} />
      <ResizeHandle element={element} rootRef={rootRef} />
      <CardActionBar element={element} />
      <div className="p-3">
        <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {rows} baris · {cols} kolom · klik dua kali untuk buka
        </p>
      </div>
    </div>
  );
}

export const DatabaseCard = memo(DatabaseCardBase);
