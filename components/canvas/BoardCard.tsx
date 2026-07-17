"use client";

import { memo } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { BoardRefElement } from "@/lib/types";
import { ConnectHandle } from "./ConnectHandle";

function BoardCardBase({ element }: { element: BoardRefElement }) {
  const targetId = element.content.boardId;
  const selected = useCanvasStore((s) => s.selectedId === element.id);
  const title = useCanvasStore((s) => s.boards[targetId]?.title ?? "Papan");
  const count = useCanvasStore(
    (s) => Object.values(s.elements).filter((e) => e.boardId === targetId).length
  );
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
        "group absolute cursor-grab rounded-md bg-white shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-blue-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
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
      {/* Pita atas: penanda visual bahwa ini papan, bukan catatan */}
      <div className="h-6 rounded-t-md bg-neutral-100" />
      <div className="p-3">
        <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {count === 0 ? "Kosong" : `${count} item`} · klik dua kali untuk buka
        </p>
      </div>
    </div>
  );
}

export const BoardCard = memo(BoardCardBase);
