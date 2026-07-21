"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportBoardPng } from "@/lib/exportImage";
import { buildPresentationOrder } from "@/lib/presentation";
import { searchWorkspace } from "@/lib/search";
import { useCanvasStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { INBOX_BOARD_ID } from "@/lib/types";
import { useUiStore } from "@/lib/ui";

/** Titik tengah viewport dalam koordinat world — untuk menaruh kartu baru dari
 *  palet perintah, konsisten dengan tombol toolbar. */
function centerWorld() {
  const { camera } = useCanvasStore.getState();
  const W = typeof window !== "undefined" ? window.innerWidth : 1200;
  const H = typeof window !== "undefined" ? window.innerHeight : 800;
  return { x: (W / 2 - camera.x) / camera.zoom, y: (H / 2 - camera.y) / camera.zoom };
}

interface Command {
  id: string;
  label: string;
  icon: string;
  keywords: string; // untuk pencocokan ketikan
  run: () => void;
}

/** Perintah cepat (palet). Handler membaca store lewat getState saat dijalankan,
 *  jadi daftarnya tak perlu berlangganan apa pun. */
const COMMANDS: Command[] = [
  {
    id: "note",
    label: "Catatan baru",
    icon: "📝",
    keywords: "catatan note baru new tambah",
    run: () => {
      const { x, y } = centerWorld();
      useCanvasStore.getState().addNote(x, y);
    },
  },
  {
    id: "task",
    label: "Daftar tugas baru",
    icon: "☑️",
    keywords: "tugas task daftar baru checklist",
    run: () => {
      const { x, y } = centerWorld();
      useCanvasStore.getState().addTaskList(x, y);
    },
  },
  {
    id: "board",
    label: "Papan baru",
    icon: "🗂️",
    keywords: "papan board baru kanvas",
    run: () => {
      const { x, y } = centerWorld();
      useCanvasStore.getState().addBoard(x, y);
    },
  },
  {
    id: "database",
    label: "Database baru",
    icon: "▦",
    keywords: "database tabel table baru",
    run: () => {
      const { x, y } = centerWorld();
      useCanvasStore.getState().addDatabase(x, y);
    },
  },
  {
    id: "inbox",
    label: "Buka Inbox",
    icon: "📥",
    keywords: "inbox tangkap capture buka",
    run: () => useCanvasStore.getState().openBoard(INBOX_BOARD_ID),
  },
  {
    id: "present",
    label: "Mulai presentasi",
    icon: "▶",
    keywords: "presentasi present slideshow jalan",
    run: () => {
      const st = useCanvasStore.getState();
      const onBoard = Object.values(st.elements).filter((e) => e.boardId === st.currentBoardId);
      const cards = onBoard
        .filter((e) => e.type !== "CONNECTOR")
        .map((c) => ({ id: c.id, x: c.x, y: c.y }));
      const connectors = onBoard.filter((e) => e.type === "CONNECTOR");
      useUiStore.getState().startPresentation(buildPresentationOrder(cards, connectors));
    },
  },
  {
    id: "export",
    label: "Ekspor papan ke PNG",
    icon: "🖼",
    keywords: "ekspor export png gambar unduh",
    run: async () => {
      const res = await exportBoardPng();
      if (res.ok) toast("PNG diekspor");
      else window.alert(`Ekspor gagal: ${res.reason}`);
    },
  },
];

/** Palet: pencarian lintas papan + perintah cepat. Cmd/Ctrl+K. Ketik untuk
 *  memfilter; ↑/↓ pilih; Enter jalankan. Gerbang mount supaya state mulai
 *  bersih tiap dibuka. */
export function SearchPanel() {
  const open = useUiStore((s) => s.searchOpen);
  if (!open) return null;
  return <SearchPanelInner />;
}

function SearchPanelInner() {
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

  const q = query.trim().toLowerCase();
  const commands = useMemo(
    () =>
      q === ""
        ? COMMANDS
        : COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q)),
    [q]
  );

  // Daftar gabungan: perintah dulu, lalu hasil pencarian. Satu indeks `sel`
  // menelusuri keduanya.
  const items = useMemo(
    () => [
      ...commands.map((c) => ({ kind: "command" as const, command: c })),
      ...results.map((h) => ({ kind: "hit" as const, hit: h })),
    ],
    [commands, results]
  );

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const activate = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === "command") it.command.run();
    else if (it.hit.kind === "element") focusElement(it.hit.id);
    else openBoard(it.hit.id);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(0, items.length - 1)));
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

  const commandCount = commands.length;

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
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0); // hasil berubah → mulai dari atas
          }}
          onKeyDown={onKeyDown}
          placeholder="Cari atau ketik perintah…"
          className="w-full border-b border-neutral-200 px-4 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />

        <div className="max-h-[50vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-400">Tidak ada hasil.</p>
          ) : (
            <ul>
              {items.map((it, i) => {
                const active = i === sel;
                // Label bagian: "Aksi" di atas grup perintah, "Hasil" di atas
                // grup pencarian (hanya di baris pertama tiap grup).
                const heading =
                  i === 0 && it.kind === "command"
                    ? "Aksi"
                    : i === commandCount && it.kind === "hit"
                      ? "Hasil"
                      : null;
                return (
                  <li key={it.kind === "command" ? `c-${it.command.id}` : `h-${it.hit.kind}-${it.hit.id}`}>
                    {heading && (
                      <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        {heading}
                      </p>
                    )}
                    <button
                      onMouseEnter={() => setSel(i)}
                      onClick={() => activate(i)}
                      className={[
                        "flex w-full items-baseline gap-2 px-4 py-2 text-left",
                        active ? "bg-blue-50" : "hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      {it.kind === "command" ? (
                        <>
                          <span className="w-5 shrink-0 text-center text-sm">{it.command.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                            {it.command.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                            {it.hit.typeLabel}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-neutral-800">{it.hit.label}</span>
                            {it.hit.snippet !== it.hit.label && (
                              <span className="block truncate text-xs text-neutral-400">{it.hit.snippet}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[11px] text-neutral-400">{it.hit.boardTitle}</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
