"use client";

import { useMemo, useState } from "react";
import { backlinksTo } from "@/lib/backlinks";
import { breadcrumbPath, useCanvasStore } from "@/lib/store";

export function Breadcrumb() {
  // Subscribe ke state yang referensinya stabil, lalu hitung jalurnya di
  // useMemo — jangan bikin array baru di dalam selector (memicu render loop).
  const boards = useCanvasStore((s) => s.boards);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const path = useMemo(() => breadcrumbPath(boards, currentBoardId), [boards, currentBoardId]);

  const openBoard = useCanvasStore((s) => s.openBoard);
  const renameBoard = useCanvasStore((s) => s.renameBoard);
  const elements = useCanvasStore((s) => s.elements);
  const focusElement = useCanvasStore((s) => s.focusElement);
  const [draft, setDraft] = useState<string | null>(null);
  const [backOpen, setBackOpen] = useState(false);

  // Referensi balik ke papan yang sedang dibuka (spec §9.3).
  const backlinks = useMemo(
    () => backlinksTo(currentBoardId, elements),
    [currentBoardId, elements]
  );

  const current = path[path.length - 1];
  if (!current) return null;

  return (
    <div className="flex min-w-0 max-w-[46vw] items-center gap-1 text-sm">
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
          className="w-48 rounded border border-neutral-300 px-1 font-medium text-neutral-900 outline-none focus:border-indigo-400"
        />
      )}

      {backlinks.length > 0 && (
        <div className="relative ml-1 flex items-center">
          <span className="mr-1 text-neutral-300">·</span>
          <button
            onClick={() => setBackOpen((v) => !v)}
            title="Referensi balik: catatan yang me-mention papan ini"
            className={[
              "rounded px-1.5 py-0.5 text-xs",
              backOpen ? "bg-indigo-50 text-indigo-700" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
            ].join(" ")}
          >
            ↩ {backlinks.length}
          </button>
          {backOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                Referensi balik
              </p>
              {backlinks.map((bl) => (
                <button
                  key={bl.noteId}
                  onClick={() => {
                    focusElement(bl.noteId);
                    setBackOpen(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-50"
                >
                  <span className="block truncate text-sm text-neutral-700">{bl.snippet}</span>
                  <span className="block truncate text-[11px] text-neutral-400">
                    di {boards[bl.boardId]?.title ?? "papan"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
