"use client";

import { memo, useRef } from "react";
import { daysFromToday, formatShort } from "@/lib/dates";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { TaskItem, TaskListElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";

/** Kontrol tenggat mungil per item: tombol (tanggal atau ikon) yang memicu
 *  pemilih tanggal native lewat input tersembunyi di sebelahnya. */
function DueControl({ item, onChange }: { item: TaskItem; onChange: (due: string | null) => void }) {
  const overdue = !!item.due && !item.done && daysFromToday(item.due) < 0;
  const cls = item.due
    ? overdue
      ? "text-red-500"
      : "text-neutral-500"
    : "text-neutral-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100";
  return (
    <span className={`relative shrink-0 text-xs tabular-nums ${cls}`}>
      <button
        type="button"
        title={item.due ? `Tenggat ${item.due} — klik untuk ubah` : "Setel tenggat"}
        onClick={(e) => {
          const input = e.currentTarget.nextElementSibling as HTMLInputElement | null;
          if (!input) return;
          input.focus();
          try {
            input.showPicker?.();
          } catch {
            /* butuh gesture / tak didukung — input tetap bisa diketik */
          }
        }}
        className="cursor-pointer px-1 hover:text-neutral-700"
      >
        {item.due ? formatShort(item.due) : "📅"}
      </button>
      <input
        type="date"
        value={item.due ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        tabIndex={-1}
        aria-label="Tenggat"
        className="absolute inset-0 h-0 w-0 opacity-0"
      />
    </span>
  );
}

function TaskListCardBase({ element }: { element: TaskListElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const setTaskListTitle = useCanvasStore((s) => s.setTaskListTitle);
  const addTaskItem = useCanvasStore((s) => s.addTaskItem);
  const setTaskText = useCanvasStore((s) => s.setTaskText);
  const setTaskDue = useCanvasStore((s) => s.setTaskDue);
  const toggleTask = useCanvasStore((s) => s.toggleTask);
  const removeTaskItem = useCanvasStore((s) => s.removeTaskItem);

  const { rootRef, dragHandlers } = useElementDrag(element);
  const inputRefs = useRef(new Map<string, HTMLInputElement | null>());

  const { title, items } = element.content;
  const done = items.filter((i) => i.done).length;

  const focusItem = (itemId: string) => {
    // tunggu satu frame supaya input yang baru sudah ada di DOM
    requestAnimationFrame(() => inputRefs.current.get(itemId)?.focus());
  };

  const onItemKeyDown = (e: React.KeyboardEvent, itemId: string, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newId = addTaskItem(element.id, itemId);
      if (newId) focusItem(newId);
      return;
    }
    // Backspace di item kosong → hapus, fokus pindah ke item sebelumnya
    if (e.key === "Backspace" && (e.currentTarget as HTMLInputElement).value === "") {
      if (items.length === 1) return; // sisakan minimal satu baris
      e.preventDefault();
      e.stopPropagation(); // jangan sampai Canvas ikut menghapus kartunya
      const prev = items[index - 1];
      removeTaskItem(element.id, itemId);
      if (prev) focusItem(prev.id);
    }
  };

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab rounded-md bg-white p-3 shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-blue-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
    >
      <ConnectHandle element={element} />
      <CardActionBar element={element} />

      <div className="mb-1.5 flex items-baseline gap-2">
        <input
          value={title}
          onChange={(e) => setTaskListTitle(element.id, e.target.value)}
          placeholder="Judul daftar"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:font-normal placeholder:text-neutral-300"
        />
        {items.length > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-neutral-400">
            {done}/{items.length}
          </span>
        )}
      </div>

      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={item.id} className="group flex items-start gap-2">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleTask(element.id, item.id)}
              className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-500"
            />
            <input
              ref={(el) => {
                inputRefs.current.set(item.id, el);
              }}
              value={item.text}
              onChange={(e) => setTaskText(element.id, item.id, e.target.value)}
              onKeyDown={(e) => onItemKeyDown(e, item.id, i)}
              placeholder="Tugas baru"
              className={[
                "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-300",
                item.done ? "text-neutral-400 line-through" : "text-neutral-700",
              ].join(" ")}
            />
            <DueControl item={item} onChange={(due) => setTaskDue(element.id, item.id, due)} />
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          const newId = addTaskItem(element.id);
          if (newId) focusItem(newId);
        }}
        className="mt-1.5 text-xs text-neutral-400 hover:text-neutral-700"
      >
        + Tambah tugas
      </button>
    </div>
  );
}

export const TaskListCard = memo(TaskListCardBase);
