"use client";

import { useEffect, useRef } from "react";
import { connectorMidpoint } from "@/lib/geometry";
import { useCanvasStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui";
import { CONNECTOR_COLORS, type Box, type ConnectorColor } from "@/lib/types";

const FALLBACK_HEIGHT = 64;

const boxOf = (id: string, x: number, y: number, width: number): Box => {
  const node = document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
  return { x, y, w: width, h: node?.offsetHeight ?? FALLBACK_HEIGHT };
};

/** Popover mini di tengah konektor yang sedang dipilih (klik garis) — ubah
 *  label/warna/gaya, atau hapus. Posisinya screen-space (bukan anak
 *  world-layer) supaya ukurannya tetap terbaca di zoom berapa pun; dihitung
 *  ulang dari camera store, bukan diikat ke transform world-layer. */
export function ConnectorPopover() {
  const editingConnectorId = useUiStore((s) => s.editingConnectorId);
  const setEditingConnector = useUiStore((s) => s.setEditingConnector);
  const camera = useCanvasStore((s) => s.camera);
  const connector = useCanvasStore((s) =>
    editingConnectorId ? s.elements[editingConnectorId] : null
  );
  const source = useCanvasStore((s) =>
    connector && connector.type === "CONNECTOR" ? s.elements[connector.sourceElementId] : null
  );
  const target = useCanvasStore((s) =>
    connector && connector.type === "CONNECTOR" ? s.elements[connector.targetElementId] : null
  );
  const updateConnector = useCanvasStore((s) => s.updateConnector);
  const removeElement = useCanvasStore((s) => s.removeElement);
  const rootRef = useRef<HTMLDivElement>(null);

  // Klik di luar / Escape → tutup. Ini juga yang "menyelamatkan" popover dari
  // basi kalau user mulai pan/drag (gestur itu selalu diawali pointerdown,
  // yang berarti listener ini menutupnya duluan) — jadi tak perlu melacak
  // ulang posisi tiap frame pan/zoom, cukup tutup begitu user mulai gerak.
  useEffect(() => {
    if (!editingConnectorId) return;
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setEditingConnector(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingConnector(null);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [editingConnectorId, setEditingConnector]);

  if (!connector || connector.type !== "CONNECTOR" || !source || !target) return null;
  if (source.type === "CONNECTOR" || target.type === "CONNECTOR") return null;

  const mid = connectorMidpoint(
    boxOf(source.id, source.x, source.y, source.width),
    boxOf(target.id, target.x, target.y, target.width)
  );
  // world → koordinat lokal container (sama seperti transform world-layer:
  // translate3d(camera.x, camera.y) scale(camera.zoom) relatif ke container).
  const left = mid.x * camera.zoom + camera.x;
  const top = mid.y * camera.zoom + camera.y;

  const colors = Object.keys(CONNECTOR_COLORS) as ConnectorColor[];

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-20 flex -translate-x-1/2 -translate-y-full flex-col gap-2 rounded-lg bg-white/95 p-2 shadow-md ring-1 ring-neutral-200 backdrop-blur"
      style={{ left, top: top - 10 }}
    >
      <input
        autoFocus
        value={connector.label ?? ""}
        onChange={(e) => updateConnector(connector.id, { label: e.target.value })}
        placeholder="Label garis…"
        className="w-40 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-forest-300"
      />
      <div className="flex items-center gap-1">
        {colors.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => updateConnector(connector.id, { color: c })}
            className={[
              "h-5 w-5 shrink-0 rounded-full ring-offset-1 transition-shadow",
              (connector.color ?? "gray") === c ? "ring-2 ring-neutral-400" : "hover:ring-1 hover:ring-neutral-300",
            ].join(" ")}
            style={{ backgroundColor: CONNECTOR_COLORS[c] }}
          />
        ))}
        <button
          title={connector.style === "dashed" ? "Jadikan garis solid" : "Jadikan garis putus-putus"}
          onClick={() =>
            updateConnector(connector.id, { style: connector.style === "dashed" ? "solid" : "dashed" })
          }
          className="ml-1 rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          {connector.style === "dashed" ? "┄" : "―"}
        </button>
        <button
          title="Hapus garis"
          onClick={() => {
            removeElement(connector.id);
            setEditingConnector(null);
          }}
          className="ml-auto rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-red-50 hover:text-red-600"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
