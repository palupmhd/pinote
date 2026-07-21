"use client";

import { memo, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { NoteElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { ConnectHandle } from "./ConnectHandle";

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

function NoteCardBase({ element }: { element: NoteElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const editing = useCanvasStore((s) => s.editingId === element.id);
  const setEditing = useCanvasStore((s) => s.setEditing);

  // saat mengetik: matikan drag supaya seleksi teks tetap jalan
  const { rootRef, dragHandlers } = useElementDrag(element, !editing);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editing) setEditing(element.id);
  };

  const html = element.content.html;
  // Saring di batas render — data catatan bisa datang korup/disuntik dari cloud.
  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute rounded-md bg-white p-3 shadow-sm transition-shadow",
        selected ? "ring-2 ring-blue-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
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
      {editing ? (
        <NoteEditor id={element.id} initialHtml={html} />
      ) : safeHtml ? (
        <div
          className="note-editor text-sm text-neutral-800"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
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
