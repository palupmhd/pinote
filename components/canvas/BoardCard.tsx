"use client";

import { memo } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { BoardRefElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { CardHeader } from "./CardHeader";
import { ConnectHandle } from "./ConnectHandle";
import { IconBoard } from "./icons";

function BoardCardBase({ element, count }: { element: BoardRefElement; count: number }) {
  const targetId = element.content.boardId;
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const title = useCanvasStore((s) => s.boards[targetId]?.title ?? "Papan");
  const openBoard = useCanvasStore((s) => s.openBoard);

  const { rootRef, wasDragged, dragHandlers } = useElementDrag(element);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wasDragged()) openBoard(targetId);
  };

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab rounded-xl bg-white shadow-sm transition-shadow active:cursor-grabbing",
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
      <CardActionBar element={element} />
      <CardHeader icon={<IconBoard className="h-3.5 w-3.5" />} label="Papan" />
      <div className="px-3 pb-3">
        <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {count === 0 ? "Kosong" : `${count} item`} · klik dua kali untuk buka
        </p>
      </div>
    </div>
  );
}

export const BoardCard = memo(BoardCardBase);
