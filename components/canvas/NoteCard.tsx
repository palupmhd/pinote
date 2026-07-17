"use client";

import { memo, useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCanvasStore } from "@/lib/store";
import type { BoardElement } from "@/lib/types";

const DRAG_THRESHOLD = 3;

// Editor hanya di-mount saat note sedang diedit — supaya note yang diam tidak
// menahan instance ProseMirror (berat) dan tidak ikut re-render saat pan/zoom.
function NoteEditor({ id, initialHtml }: { id: string; initialHtml: string }) {
  const updateContent = useCanvasStore((s) => s.updateContent);
  const setEditing = useCanvasStore((s) => s.setEditing);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    immediatelyRender: false,
    autofocus: "end",
    onUpdate: ({ editor }) => updateContent(id, editor.getHTML()),
    onBlur: () => {
      const { editingId } = useCanvasStore.getState();
      if (editingId === id) setEditing(null);
    },
  });

  return <EditorContent editor={editor} className="note-editor text-sm text-neutral-800" />;
}

function NoteCardBase({ element }: { element: BoardElement }) {
  const selected = useCanvasStore((s) => s.selectedId === element.id);
  const editing = useCanvasStore((s) => s.editingId === element.id);
  const select = useCanvasStore((s) => s.select);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const moveElement = useCanvasStore((s) => s.moveElement);

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);

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
      curX: element.x,
      curY: element.y,
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
    drag.curX = drag.startX + dx / zoom;
    drag.curY = drag.startY + dy / zoom;
    // Geser langsung via DOM — tanpa update store / re-render tiap frame.
    if (rootRef.current) {
      rootRef.current.style.left = `${drag.curX}px`;
      rootRef.current.style.top = `${drag.curY}px`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // Commit sekali ke store saat dilepas (untuk persistence + LWW).
    if (drag.moved) moveElement(element.id, drag.curX, drag.curY);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editing) setEditing(element.id);
  };

  const html = element.content.html;

  return (
    <div
      ref={rootRef}
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
      {editing ? (
        <NoteEditor id={element.id} initialHtml={html} />
      ) : html ? (
        <div
          className="note-editor text-sm text-neutral-800"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-neutral-300">Catatan kosong</p>
      )}
    </div>
  );
}

// Memoize: saat pan/zoom (camera berubah) Canvas re-render, tapi prop `element`
// tiap card tetap referensi sama, jadi card tidak ikut re-render.
export const NoteCard = memo(NoteCardBase);
