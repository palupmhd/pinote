"use client";

import { memo, useEffect, useRef } from "react";
import { daysFromToday, formatShort } from "@/lib/dates";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { TaskItem, TaskListElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { CardHeader } from "./CardHeader";
import { ConnectHandle } from "./ConnectHandle";
import { IconTask } from "./icons";

/** Kontrol tenggat mungil per item: label terlihat (tanggal atau ikon) dengan
 *  input date native transparan menutupinya. Input-nya nyata (bisa di-Tab,
 *  dioperasikan keyboard, dan menampilkan pemilih native) — bukan lagi kotak
 *  0×0 tabIndex -1 yang tak terjangkau keyboard dan rusak tanpa showPicker.
 *  Selalu aktif terlepas dari mode edit — mengatur tenggat bukan "edit teks"
 *  yang dimaksud gerbang dobel-klik di bawah. */
function DueControl({ item, onChange }: { item: TaskItem; onChange: (due: string | null) => void }) {
  const overdue = !!item.due && !item.done && daysFromToday(item.due) < 0;
  const cls = item.due
    ? overdue
      ? "text-red-500"
      : "text-neutral-500"
    : "text-neutral-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100";
  return (
    <span className={`relative inline-flex shrink-0 items-center text-xs tabular-nums ${cls}`}>
      <span aria-hidden className="pointer-events-none px-1">
        {item.due ? formatShort(item.due) : "📅"}
      </span>
      <input
        type="date"
        value={item.due ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onPointerDown={(e) => e.stopPropagation()} // jangan mulai drag kartu
        onClick={(e) => {
          // Buka pemilih native bila didukung; kalau tidak, input tetap fokus &
          // bisa diketik/dioperasikan keyboard.
          try {
            (e.currentTarget as HTMLInputElement).showPicker?.();
          } catch {
            /* butuh gesture / tak didukung */
          }
        }}
        aria-label={item.due ? `Tenggat ${item.due}, ubah` : "Setel tenggat"}
        title={item.due ? `Tenggat ${item.due}` : "Setel tenggat"}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </span>
  );
}

function TaskListCardBase({ element }: { element: TaskListElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const editing = useCanvasStore((s) => s.editingId === element.id);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const setTaskListTitle = useCanvasStore((s) => s.setTaskListTitle);
  const addTaskItem = useCanvasStore((s) => s.addTaskItem);
  const setTaskText = useCanvasStore((s) => s.setTaskText);
  const setTaskDue = useCanvasStore((s) => s.setTaskDue);
  const toggleTask = useCanvasStore((s) => s.toggleTask);
  const removeTaskItem = useCanvasStore((s) => s.removeTaskItem);

  // Drag dimatikan selagi editing (konsisten dg NoteCard) — supaya seleksi
  // teks di dalam input tak dianggap awal sebuah geseran.
  const { rootRef, dragHandlers } = useElementDrag(element, !editing);
  const inputRefs = useRef(new Map<string, HTMLInputElement | null>());
  const titleRef = useRef<HTMLInputElement>(null);

  const { title, items } = element.content;
  const done = items.filter((i) => i.done).length;

  const focusItem = (itemId: string) => {
    // tunggu satu frame supaya input yang baru sudah ada di DOM
    requestAnimationFrame(() => inputRefs.current.get(itemId)?.focus());
  };

  // Dobel-klik di badan kartu → masuk mode edit; fokus field yang di-dobel-klik
  // (judul atau item tertentu) supaya kursor langsung di tempat yang dimaksud.
  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing) return;
    setEditing(element.id);
    const target = e.target as HTMLElement;
    const itemId = target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    requestAnimationFrame(() => {
      if (itemId) inputRefs.current.get(itemId)?.focus();
      else titleRef.current?.focus();
    });
  };

  // Keluar dari mode edit: klik di luar kartu, atau Escape — bukan per-field
  // blur (yang akan salah memicu keluar saat berpindah antar input di kartu
  // yang sama).
  useEffect(() => {
    if (!editing) return;
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setEditing(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(null);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing, setEditing, rootRef]);

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
        "group absolute rounded-xl bg-white shadow-sm transition-shadow",
        selected ? "ring-2 ring-indigo-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
        editing ? "cursor-text" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        zIndex: element.zIndex,
      }}
      {...dragHandlers}
      onDoubleClick={onDoubleClick}
    >
      {!editing && <ConnectHandle element={element} />}
      <CardActionBar element={element} />
      <CardHeader icon={<IconTask className="h-3.5 w-3.5" />} label="Tugas" />

      <div className="px-3 pb-3">
        <div className="mb-1.5 flex items-baseline gap-2">
          {editing ? (
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTaskListTitle(element.id, e.target.value)}
              placeholder="Judul daftar"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:font-normal placeholder:text-neutral-300"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
              {title || <span className="font-normal text-neutral-300">Judul daftar</span>}
            </span>
          )}
          {items.length > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-neutral-400">
              {done}/{items.length}
            </span>
          )}
        </div>

        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={item.id} data-item-id={item.id} className="group flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleTask(element.id, item.id)}
                className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-indigo-500"
              />
              {editing ? (
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
              ) : (
                <span
                  className={[
                    "min-w-0 flex-1 truncate text-sm",
                    item.done ? "text-neutral-400 line-through" : "text-neutral-700",
                  ].join(" ")}
                >
                  {item.text || <span className="text-neutral-300">Tugas baru</span>}
                </span>
              )}
              <DueControl item={item} onChange={(due) => setTaskDue(element.id, item.id, due)} />
            </li>
          ))}
        </ul>

        {editing && (
          <button
            onClick={() => {
              const newId = addTaskItem(element.id);
              if (newId) focusItem(newId);
            }}
            className="mt-1.5 text-xs text-neutral-400 hover:text-neutral-700"
          >
            + Tambah tugas
          </button>
        )}
      </div>
    </div>
  );
}

export const TaskListCard = memo(TaskListCardBase);
