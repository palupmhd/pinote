"use client";

import { useMemo, useState } from "react";
import { breadcrumbPath, useCanvasStore } from "@/lib/store";

export function Breadcrumb() {
  // Subscribe ke state yang referensinya stabil, lalu hitung jalurnya di
  // useMemo — jangan bikin array baru di dalam selector (memicu render loop).
  const boards = useCanvasStore((s) => s.boards);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const path = useMemo(() => breadcrumbPath(boards, currentBoardId), [boards, currentBoardId]);

  const openBoard = useCanvasStore((s) => s.openBoard);
  const renameBoard = useCanvasStore((s) => s.renameBoard);
  const [draft, setDraft] = useState<string | null>(null);

  const current = path[path.length - 1];
  if (!current) return null;

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 flex max-w-[70vw] items-center gap-1 rounded-md bg-white/90 px-3 py-1.5 text-sm shadow-sm ring-1 ring-neutral-200 backdrop-blur">
      {path.slice(0, -1).map((b) => (
        <span key={b.id} className="flex items-center gap-1">
          <button
            onClick={() => openBoard(b.id)}
            className="max-w-[160px] truncate text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            {b.title}
          </button>
          <span className="text-neutral-300">/</span>
        </span>
      ))}

      {draft === null ? (
        <button
          onDoubleClick={() => setDraft(current.title)}
          title="Klik dua kali untuk ganti nama"
          className="max-w-[220px] truncate font-medium text-neutral-900"
        >
          {current.title}
        </button>
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const t = draft.trim();
            if (t) renameBoard(current.id, t);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setDraft(null);
          }}
          className="w-48 rounded border border-neutral-300 px-1 font-medium text-neutral-900 outline-none focus:border-blue-400"
        />
      )}
    </div>
  );
}
