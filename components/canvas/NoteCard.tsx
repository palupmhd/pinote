"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCanvasStore } from "@/lib/store";
import type { BoardElement } from "@/lib/types";

const DRAG_THRESHOLD = 3;

export function NoteCard({ element }: { element: BoardElement }) {
  const selected = useCanvasStore((s) => s.selectedId === element.id);
  const editing = useCanvasStore((s) => s.editingId === element.id);
  const select = useCanvasStore((s) => s.select);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const moveElement = useCanvasStore((s) => s.moveElement);
  const updateContent = useCanvasStore((s) => s.updateContent);

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: element.content.html,
    editable: editing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => updateContent(element.id, editor.getHTML()),
    onBlur: () => {
      const { editingId } = useCanvasStore.getState();
      if (editingId === element.id) setEditing(null);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editing);
    if (editing) editor.commands.focus("end");
  }, [editing, editor]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return; // saat mengetik: biarkan seleksi teks, jangan drag
    if (e.button !== 0) return;
    e.stopPropagation();
    select(element.id);
    bringToFront(element.id);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: element.x,
      startY: element.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const { zoom } = useCanvasStore.getState().camera;
    moveElement(element.id, drag.startX + dx / zoom, drag.startY + dy / zoom);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editing) setEditing(element.id);
  };

  return (
    <div
      className={[
        "absolute rounded-md bg-white p-3 shadow-sm transition-shadow",
        selected ? "ring-2 ring-blue-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
        editing ? "cursor-text" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        zIndex: element.zIndex,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <EditorContent
        editor={editor}
        className={[
          "note-editor text-sm text-neutral-800",
          editing ? "" : "pointer-events-none",
        ].join(" ")}
      />
      {!editing && !element.content.html && (
        <p className="text-sm text-neutral-300">Catatan kosong</p>
      )}
    </div>
  );
}
