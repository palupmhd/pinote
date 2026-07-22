"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useCanvasStore } from "@/lib/store";
import { exportBoardPng } from "@/lib/exportImage";
import { firstImageFile, importImageFile } from "@/lib/images";
import { buildPresentationOrder } from "@/lib/presentation";
import { toast } from "@/lib/toast";
import { useUiStore } from "@/lib/ui";
import { type Camera, type CardElement, type ConnectorElement } from "@/lib/types";
import { DatabasePicker } from "./DatabasePicker";
import { TemplatePicker } from "./TemplatePicker";
import {
  IconBoard,
  IconDots,
  IconExport,
  IconImage,
  IconLink,
  IconNote,
  IconPlus,
  IconPresent,
  IconTable,
  IconTask,
} from "./icons";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  cameraRef: RefObject<Camera>;
}

type ToolLabel = "Catatan" | "Tugas" | "Gambar" | "Tautan" | "Tabel" | "Papan";
const TOOLS: { label: ToolLabel; hint: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { label: "Catatan", hint: "Tambah catatan", Icon: IconNote },
  { label: "Tugas", hint: "Tambah daftar tugas", Icon: IconTask },
  { label: "Gambar", hint: "Tambah gambar (atau tempel/seret ke kanvas)", Icon: IconImage },
  { label: "Tautan", hint: "Tambah tautan dengan pratinjau", Icon: IconLink },
  { label: "Tabel", hint: "Tambah tabel bertipe (database)", Icon: IconTable },
  { label: "Papan", hint: "Tambah papan (bisa dibuka jadi kanvas sendiri)", Icon: IconBoard },
];

/** Toolbar utama di bawah-tengah kanvas (gaya Milanote): tombol buat berlabel +
 *  tombol tambah utama. Elemen baru diletakkan di tengah viewport papan yang
 *  sedang dibuka (dihitung dari kamera "hidup", bukan dari state). */
export function Toolbar({ containerRef, cameraRef }: Props) {
  const addNote = useCanvasStore((s) => s.addNote);
  const addBoard = useCanvasStore((s) => s.addBoard);
  const addTaskList = useCanvasStore((s) => s.addTaskList);
  const addLink = useCanvasStore((s) => s.addLink);
  const addDatabase = useCanvasStore((s) => s.addDatabase);
  const addBoardFromTemplate = useCanvasStore((s) => s.addBoardFromTemplate);
  const attachDatabase = useCanvasStore((s) => s.attachDatabase);
  const addImage = useCanvasStore((s) => s.addImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startPresentation = useUiStore((s) => s.startPresentation);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [moreOpen]);

  const viewportCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    return { x: (cx - cam.x) / cam.zoom, y: (cy - cam.y) / cam.zoom };
  };

  const runTool = (label: ToolLabel) => {
    if (label === "Gambar") {
      fileInputRef.current?.click();
      return;
    }
    const { x, y } = viewportCenter();
    if (label === "Catatan") addNote(x, y);
    else if (label === "Tugas") addTaskList(x, y);
    else if (label === "Tautan") addLink(x, y);
    else if (label === "Papan") addBoard(x, y);
    else if (label === "Tabel") addDatabase(x, y);
  };

  const onPresent = () => {
    const st = useCanvasStore.getState();
    const onBoard = Object.values(st.elements).filter((e) => e.boardId === st.currentBoardId);
    const cards = onBoard
      .filter((e): e is CardElement => e.type !== "CONNECTOR")
      .map((c) => ({ id: c.id, x: c.x, y: c.y }));
    const connectors = onBoard.filter((e): e is ConnectorElement => e.type === "CONNECTOR");
    startPresentation(buildPresentationOrder(cards, connectors));
    setMoreOpen(false);
  };

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setMoreOpen(false);
    setExporting(true);
    const res = await exportBoardPng();
    setExporting(false);
    if (res.ok) toast("PNG diekspor");
    else window.alert(`Ekspor gagal: ${res.reason}`);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = firstImageFile(e.target.files);
    e.target.value = "";
    if (!file) return;
    const img = await importImageFile(file);
    if (img) {
      const { x, y } = viewportCenter();
      addImage(x, y, img);
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur">
      {/* Tombol tambah utama: catatan cepat di tengah kanvas. */}
      <button
        onClick={() => {
          const { x, y } = viewportCenter();
          addNote(x, y);
        }}
        title="Catatan cepat"
        className="mr-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        <IconPlus className="h-5 w-5" />
      </button>

      {TOOLS.map(({ label, hint, Icon }) => (
        <button
          key={label}
          onClick={() => runTool(label)}
          title={hint}
          className="flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />

      <div className="mx-0.5 h-8 w-px bg-neutral-200" />

      {/* Overflow: aksi papan (template, panggil database, presentasi, ekspor). */}
      <div ref={moreRef} className="relative">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          title="Lainnya"
          className={[
            "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
            moreOpen ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
          ].join(" ")}
        >
          <IconDots className="h-5 w-5" />
        </button>

        {moreOpen && (
          <div className="absolute bottom-full right-0 z-20 mb-2 w-60 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
            <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Papan baru
            </p>
            <TemplatePicker
              onPick={(tpl) => {
                const { x, y } = viewportCenter();
                addBoardFromTemplate(tpl, x, y);
                setMoreOpen(false);
              }}
            />
            <DatabasePicker
              onAttach={(dbId) => {
                const { x, y } = viewportCenter();
                attachDatabase(dbId, x, y);
                setMoreOpen(false);
              }}
            />
            <div className="my-1 h-px bg-neutral-100" />
            <button
              onClick={onPresent}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            >
              <IconPresent className="h-4 w-4 text-neutral-500" /> Presentasi
            </button>
            <button
              onClick={onExport}
              disabled={exporting}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:pointer-events-none disabled:text-neutral-400"
            >
              <IconExport className="h-4 w-4 text-neutral-500" /> {exporting ? "Mengekspor…" : "Ekspor PNG"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
