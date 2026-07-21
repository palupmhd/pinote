"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchWorkspace } from "@/lib/search";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";

/** Palet pencarian lintas papan (spec §6 gap #6). Ketik untuk mencari catatan,
 *  tugas, tautan, database, dan judul papan; ↑/↓ pilih, Enter loncat. */
export function SearchPanel() {
  const open = useUiStore((s) => s.searchOpen);
  const close = useUiStore((s) => s.closeSearch);
  const boards = useCanvasStore((s) => s.boards);
  const elements = useCanvasStore((s) => s.elements);
  const databases = useCanvasStore((s) => s.databases);
  const focusElement = useCanvasStore((s) => s.focusElement);
  const openBoard = useCanvasStore((s) => s.openBoard);

  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchWorkspace({ boards, elements, databases }, query),
    [boards, elements, databases, query]
  );

  // Buka bersih & fokuskan input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => setSel(0), [query]);

  if (!open) return null;

  const activate = (i: number) => {
    const hit = results[i];
    if (!hit) return;
    if (hit.kind === "element") focusElement(hit.id);
    else openBoard(hit.id);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(sel);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 flex items-start justify-center bg-neutral-900/20 pt-[12vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close(); // klik latar = tutup
      }}
    >
      <div className="w-[32rem] max-w-[92vw] overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-neutral-200">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Cari catatan, tugas, tautan, database, papan…"
          className="w-full border-b border-neutral-200 px-4 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />

        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() === "" ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-400">
              Ketik untuk mencari di semua papan.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-400">Tidak ada hasil.</p>
          ) : (
            <ul>
              {results.map((hit, i) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    onMouseEnter={() => setSel(i)}
                    onClick={() => activate(i)}
                    className={[
                      "flex w-full items-baseline gap-2 px-4 py-2 text-left",
                      i === sel ? "bg-blue-50" : "hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                      {hit.typeLabel}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-800">{hit.label}</span>
                      {hit.snippet !== hit.label && (
                        <span className="block truncate text-xs text-neutral-400">{hit.snippet}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">{hit.boardTitle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
