"use client";

import { memo, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { TaskListElement } from "@/lib/types";
import { ConnectHandle } from "./ConnectHandle";

function TaskListCardBase({ element }: { element: TaskListElement }) {
  const selected = useCanvasStore((s) => s.selectedId === element.id);
  const setTaskListTitle = useCanvasStore((s) => s.setTaskListTitle);
  const addTaskItem = useCanvasStore((s) => s.addTaskItem);
  const setTaskText = useCanvasStore((s) => s.setTaskText);
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
          <li key={item.id} className="flex items-start gap-2">
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
