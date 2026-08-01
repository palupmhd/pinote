"use client";

import { memo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import { useSnapAutoHeight } from "@/lib/useSnapAutoHeight";
import { CARD_GUTTER } from "@/lib/types";
import type { BoardRefElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";
import { ResizeHandle } from "./ResizeHandle";

function BoardCardBase({ element, count }: { element: BoardRefElement; count: number }) {
  const targetId = element.content.boardId;
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const title = useCanvasStore((s) => s.boards[targetId]?.title ?? "Papan");
  const openBoard = useCanvasStore((s) => s.openBoard);

  const { rootRef, wasDragged, dragHandlers } = useElementDrag(element);
  const contentRef = useRef<HTMLDivElement>(null);
  useSnapAutoHeight(contentRef, element.height === undefined);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wasDragged()) openBoard(targetId);
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
        <ConnectHandle element={element} />
        <ResizeHandle element={element} rootRef={rootRef} contentRef={contentRef} />
        <CardActionBar element={element} />
        <div ref={contentRef} className="overflow-y-auto p-3" style={{ height: element.height }}>
          <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {count === 0 ? "Kosong" : `${count} item`} · klik dua kali untuk buka
          </p>
        </div>
      </div>
    </div>
  );
}

export const BoardCard = memo(BoardCardBase);
