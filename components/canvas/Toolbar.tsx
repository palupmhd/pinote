"use client";

import { useRef, useState, type RefObject } from "react";
import { useCanvasStore } from "@/lib/store";
import { exportBoardPng } from "@/lib/exportImage";
import { redo, undo, useHistoryStore } from "@/lib/history";
import { firstImageFile, importImageFile } from "@/lib/images";
import { buildPresentationOrder } from "@/lib/presentation";
import { toast } from "@/lib/toast";
import { useUiStore } from "@/lib/ui";
import { INBOX_BOARD_ID, type Camera, type CardElement, type ConnectorElement } from "@/lib/types";
import { DatabasePicker } from "./DatabasePicker";
import { TemplatePicker } from "./TemplatePicker";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  cameraRef: RefObject<Camera>;
}

/** Konfigurasi tombol "tambah" — statik (tanpa closure yang menyentuh ref),
 *  supaya array ini tidak dibuat ulang tiap render dan tidak memicu aturan
 *  "jangan akses ref saat render". Aksinya dijalankan lewat runTool. */
const TOOLS = [
  { label: "Catatan", hint: "Tambah catatan" },
  { label: "Tugas", hint: "Tambah daftar tugas" },
  { label: "Tautan", hint: "Tambah tautan dengan pratinjau" },
  { label: "Papan", hint: "Tambah papan (bisa dibuka jadi kanvas sendiri)" },
  { label: "Database", hint: "Tambah tabel bertipe (spec §8.4)" },
  { label: "Gambar", hint: "Tambah gambar (atau tempel/seret ke kanvas)" },
] as const;

/** Toolbar kiri. Elemen baru diletakkan di tengah viewport papan yang sedang
 *  dibuka (dihitung dari kamera "hidup", bukan dari state). */
export function Toolbar({ containerRef, cameraRef }: Props) {
  const addNote = useCanvasStore((s) => s.addNote);
  const addBoard = useCanvasStore((s) => s.addBoard);
  const addTaskList = useCanvasStore((s) => s.addTaskList);
  const addLink = useCanvasStore((s) => s.addLink);
  const addDatabase = useCanvasStore((s) => s.addDatabase);
  const addBoardFromTemplate = useCanvasStore((s) => s.addBoardFromTemplate);
  const attachDatabase = useCanvasStore((s) => s.attachDatabase);
  const addImage = useCanvasStore((s) => s.addImage);
  const openBoard = useCanvasStore((s) => s.openBoard);
  const currentBoardId = useCanvasStore((s) => s.currentBoardId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const toggleAgenda = useUiStore((s) => s.toggleAgenda);
  const agendaOpen = useUiStore((s) => s.agendaOpen);
  const openSearch = useUiStore((s) => s.openSearch);
  const startPresentation = useUiStore((s) => s.startPresentation);

  const onPresent = () => {
    const st = useCanvasStore.getState();
    const onBoard = Object.values(st.elements).filter((e) => e.boardId === st.currentBoardId);
    const cards = onBoard
      .filter((e): e is CardElement => e.type !== "CONNECTOR")
      .map((c) => ({ id: c.id, x: c.x, y: c.y }));
    const connectors = onBoard.filter((e): e is ConnectorElement => e.type === "CONNECTOR");
    startPresentation(buildPresentationOrder(cards, connectors));
  };

  const viewportCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    return { x: (cx - cam.x) / cam.zoom, y: (cy - cam.y) / cam.zoom };
  };

  // Dipanggil dari onClick (event handler) → boleh membaca ref di sini.
  const runTool = (label: (typeof TOOLS)[number]["label"]) => {
    if (label === "Gambar") {
      fileInputRef.current?.click();
      return;
    }
    const { x, y } = viewportCenter();
    if (label === "Catatan") addNote(x, y);
    else if (label === "Tugas") addTaskList(x, y);
    else if (label === "Tautan") addLink(x, y);
    else if (label === "Papan") addBoard(x, y);
    else if (label === "Database") addDatabase(x, y);
  };

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setExporting(true);
    const res = await exportBoardPng();
    setExporting(false);
    if (res.ok) toast("PNG diekspor");
    else window.alert(`Ekspor gagal: ${res.reason}`);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = firstImageFile(e.target.files);
    e.target.value = ""; // izinkan memilih file yang sama lagi
    if (!file) return;
    const img = await importImageFile(file);
    if (img) {
      const { x, y } = viewportCenter();
      addImage(x, y, img);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-3 top-16 z-10 flex flex-col gap-1 rounded-md bg-white/90 p-1.5 shadow-sm ring-1 ring-neutral-200 backdrop-blur">
      {TOOLS.map((t) => (
        <div key={t.label}>
          <button
            onClick={() => runTool(t.label)}
            title={t.hint}
            className="w-full rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
          >
            + {t.label}
          </button>
          {t.label === "Database" && (
            <DatabasePicker
              onAttach={(dbId) => {
                const { x, y } = viewportCenter();
                attachDatabase(dbId, x, y);
              }}
            />
          )}
          {t.label === "Papan" && (
            <TemplatePicker
              onPick={(tpl) => {
                const { x, y } = viewportCenter();
                addBoardFromTemplate(tpl, x, y);
              }}
            />
          )}
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        className="hidden"
      />

      <div className="my-0.5 h-px bg-neutral-200" />

      <button
        onClick={openSearch}
        title="Cari di semua papan (Ctrl/Cmd+K)"
        className="rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
      >
        🔎 Cari
      </button>

      <button
        onClick={() => openBoard(INBOX_BOARD_ID)}
        title="Inbox — tangkapan cepat (Ctrl/Cmd+I untuk menangkap dari mana saja)"
        className={[
          "rounded px-3 py-1.5 text-left text-sm hover:bg-neutral-100 active:bg-neutral-200",
          currentBoardId === INBOX_BOARD_ID ? "text-blue-600" : "text-neutral-700",
        ].join(" ")}
      >
        📥 Inbox
      </button>

      <button
        onClick={onPresent}
        title="Presentasi — telusuri kartu mengikuti arah konektor (←/→, Esc keluar)"
        className="rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
      >
        ▶ Presentasi
      </button>

      <button
        onClick={onExport}
        disabled={exporting}
        title="Ekspor papan ini sebagai gambar PNG"
        className="rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:pointer-events-none disabled:text-neutral-400"
      >
        {exporting ? "Mengekspor…" : "🖼 Ekspor PNG"}
      </button>

      <button
        onClick={toggleAgenda}
        title="Agenda — semua tugas bertenggat"
        className={[
          "rounded px-3 py-1.5 text-left text-sm hover:bg-neutral-100 active:bg-neutral-200",
          agendaOpen ? "text-blue-600" : "text-neutral-700",
        ].join(" ")}
      >
        🗓 Agenda
      </button>

      <div className="flex gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Urungkan (Ctrl/Cmd+Z)"
          className="flex-1 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:pointer-events-none disabled:text-neutral-300"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Ulangi (Ctrl/Cmd+Shift+Z)"
          className="flex-1 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:pointer-events-none disabled:text-neutral-300"
        >
          ↷
        </button>
      </div>
    </div>
  );
}
