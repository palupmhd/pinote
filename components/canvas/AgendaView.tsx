"use client";

import { useMemo } from "react";
import { daysFromToday, formatShort } from "@/lib/dates";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";

interface Entry {
  listId: string;
  listTitle: string;
  boardTitle: string;
  text: string;
  done: boolean;
  due: string;
  delta: number; // hari dari hari ini (negatif = lewat)
}

const relLabel = (delta: number) => {
  if (delta === 0) return "hari ini";
  if (delta === 1) return "besok";
  if (delta === -1) return "kemarin";
  if (delta < 0) return `${-delta} hari lewat`;
  return `${delta} hari lagi`;
};

function Section({
  title,
  list,
  tint,
  onPick,
}: {
  title: string;
  list: Entry[];
  tint?: string;
  onPick: (id: string) => void;
}) {
  if (list.length === 0) return null;
  return (
    <div className="mb-4">
      <p className={`mb-1 text-xs font-medium ${tint ?? "text-neutral-500"}`}>
        {title} · {list.length}
      </p>
      <ul className="space-y-1">
        {list.map((e, i) => (
          <li key={`${e.listId}-${i}`}>
            <button
              onClick={() => onPick(e.listId)}
              className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-100"
            >
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                {formatShort(e.due)}
              </span>
              <span
                className={[
                  "min-w-0 flex-1 truncate text-sm",
                  e.done ? "text-neutral-400 line-through" : "text-neutral-800",
                ].join(" ")}
              >
                {e.text}
              </span>
              <span className="shrink-0 text-xs text-neutral-400">
                {e.boardTitle} · {relLabel(e.delta)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Panel Agenda: semua tugas bertenggat dari SELURUH papan, satu tempat.
 *  Mewujudkan "Calendar view" (spec §8) dalam bentuk daftar-agenda yang ringkas.
 *  Klik entri → loncat ke papan & kartunya (focusElement). */
export function AgendaView() {
  const open = useUiStore((s) => s.agendaOpen);
  const setAgenda = useUiStore((s) => s.setAgenda);
  const elements = useCanvasStore((s) => s.elements);
  const boards = useCanvasStore((s) => s.boards);
  const focusElement = useCanvasStore((s) => s.focusElement);

  const groups = useMemo(() => {
    const entries: Entry[] = [];
    for (const el of Object.values(elements)) {
      if (el.type !== "TASK_LIST") continue;
      for (const item of el.content.items) {
        if (!item.due) continue;
        entries.push({
          listId: el.id,
          listTitle: el.content.title.trim() || "Tanpa judul",
          boardTitle: boards[el.boardId]?.title ?? "Papan",
          text: item.text.trim() || "(tanpa teks)",
          done: item.done,
          due: item.due,
          delta: daysFromToday(item.due),
        });
      }
    }
    entries.sort((a, b) => a.due.localeCompare(b.due) || Number(a.done) - Number(b.done));

    // Kelompokkan: yang belum selesai dulu (Terlewat/Hari ini/Akan datang),
    // yang sudah selesai dikumpulkan terpisah di bawah.
    const overdue = entries.filter((e) => !e.done && e.delta < 0);
    const today = entries.filter((e) => !e.done && e.delta === 0);
    const upcoming = entries.filter((e) => !e.done && e.delta > 0);
    const done = entries.filter((e) => e.done);
    return { overdue, today, upcoming, done, total: entries.length };
  }, [elements, boards]);

  if (!open) return null;

  const go = (id: string) => {
    focusElement(id);
    setAgenda(false);
  };

  return (
    <div className="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-96 max-w-[90vw] flex-col border-l border-neutral-200 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">Agenda</h2>
        <button
          onClick={() => setAgenda(false)}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {groups.total === 0 ? (
          <p className="mt-8 text-center text-sm text-neutral-400">
            Belum ada tugas bertenggat.
            <br />
            Setel tanggal (📅) pada item daftar tugas.
          </p>
        ) : (
          <>
            <Section title="Terlewat" list={groups.overdue} tint="text-red-500" onPick={go} />
            <Section title="Hari ini" list={groups.today} tint="text-indigo-600" onPick={go} />
            <Section title="Akan datang" list={groups.upcoming} onPick={go} />
            <Section title="Selesai" list={groups.done} onPick={go} />
          </>
        )}
      </div>
    </div>
  );
}
