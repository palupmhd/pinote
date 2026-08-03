"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import { CalendarBoard } from "./CalendarBoard";
import { GalleryBoard } from "./GalleryBoard";
import { KanbanBoard } from "./KanbanBoard";
import { SpatialBoard } from "./SpatialBoard";
import { TableBoard } from "./TableBoard";

/** Editor tabel penuh untuk satu Database (spec §8.4). Dibuka dari kartu
 *  DATABASE_REF; overlay, bukan kanvas bersarang. */
export function DatabaseView() {
  const openId = useUiStore((s) => s.openDatabaseId);
  const close = useUiStore((s) => s.closeDatabase);
  const db = useCanvasStore((s) => (openId ? s.databases[openId] : undefined));
  const renameDatabase = useCanvasStore((s) => s.renameDatabase);
  const openRowAsBoard = useCanvasStore((s) => s.openRowAsBoard);
  const setDatabaseView = useCanvasStore((s) => s.setDatabaseView);
  const attachDatabaseView = useCanvasStore((s) => s.attachDatabaseView);

  // Buka isi kanvas sebuah baris: bikin/buka board bersarang lalu tutup overlay
  // ini supaya kanvas board baru kelihatan (spec §7.2, irisan tipis).
  const openRowCanvas = (rowId: string) => {
    if (openRowAsBoard(db!.id, rowId)) close();
  };

  // "Keluarkan sebagai kartu" — bikin DATABASE_VIEW baru di papan yang sedang
  // dibuka, membawa view/groupBy/dateBy yang SEDANG aktif di modal ini, lalu
  // tutup modal supaya kartunya langsung kelihatan mendarat di kanvas.
  const onExtract = () => {
    if (!db) return;
    const { camera } = useCanvasStore.getState();
    const wx = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const wy = (window.innerHeight / 2 - camera.y) / camera.zoom;
    attachDatabaseView(db.id, db.view ?? "table", wx, wy, { groupBy: db.groupBy, dateBy: db.dateBy });
    close();
  };

  // Esc menutup editor (tapi tidak saat sedang mengetik di sel — biar Esc di
  // input tak sengaja menutup seluruh tabel).
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable) {
        (t as HTMLElement).blur();
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  // Tabel bisa terhapus (mis. via undo) selagi terbuka → tutup dengan aman.
  if (!openId || !db) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-0 sm:p-6">
      {/* Layar kecil: modal penuh layar tanpa sudut/pinggir; sm+: kartu terpusat. */}
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-full sm:rounded-lg">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <input
            value={db.title}
            onChange={(e) => renameDatabase(db.id, e.target.value)}
            placeholder="Judul database"
            className="order-1 min-w-0 flex-1 basis-40 bg-transparent text-base font-semibold text-neutral-800 outline-none placeholder:text-neutral-300"
          />
          <button
            onClick={onExtract}
            title="Keluarkan tampilan ini sebagai kartu di papan"
            className="order-2 shrink-0 rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 sm:order-2"
          >
            ↗ keluarkan sebagai kartu
          </button>
          <button
            onClick={close}
            className="order-2 shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 sm:order-3"
            aria-label="Tutup"
          >
            ✕
          </button>
          {/* Pengalih tampilan (spec §7.3). Di layar sempit: baris sendiri, bisa
              digeser horizontal supaya tak menekan judul. */}
          <div className="order-3 w-full overflow-x-auto sm:order-2 sm:w-auto">
            <div className="flex w-max rounded-md bg-neutral-100 p-0.5 text-xs">
              {(["table", "kanban", "calendar", "gallery", "spatial"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDatabaseView(db.id, v)}
                  className={[
                    "shrink-0 whitespace-nowrap rounded px-2 py-1",
                    (db.view ?? "table") === v ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500",
                  ].join(" ")}
                >
                  {v === "table" ? "Tabel" : v === "kanban" ? "Kanban" : v === "calendar" ? "Kalender" : v === "gallery" ? "Galeri" : "Spasial"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(db.view ?? "table") === "kanban" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <KanbanBoard db={db} />
          </div>
        ) : (db.view ?? "table") === "calendar" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <CalendarBoard db={db} />
          </div>
        ) : (db.view ?? "table") === "gallery" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <GalleryBoard db={db} onOpenRowCanvas={openRowCanvas} />
          </div>
        ) : (db.view ?? "table") === "spatial" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SpatialBoard db={db} onOpenRowCanvas={openRowCanvas} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableBoard db={db} onOpenRowCanvas={openRowCanvas} />
          </div>
        )}
      </div>
    </div>
  );
}
