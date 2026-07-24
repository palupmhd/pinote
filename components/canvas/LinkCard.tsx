"use client";

import { memo, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { LinkElement } from "@/lib/types";
import { CardActionBar } from "./CardActionBar";
import { CardHeader } from "./CardHeader";
import { ConnectHandle } from "./ConnectHandle";
import { IconLink } from "./icons";

function LinkCardBase({ element }: { element: LinkElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const resolveLink = useCanvasStore((s) => s.resolveLink);
  const { rootRef, dragHandlers } = useElementDrag(element);

  const { url, title, description, image, siteName, state } = element.content;
  const [draft, setDraft] = useState(url);
  const [editing, setEditing] = useState(false); // "Ubah URL" pada kartu yang sudah ada

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  // Jangan sampai klik kontrol memicu drag kartu.
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const showForm = state === "empty" || editing;

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab overflow-hidden rounded-xl bg-white shadow-sm transition-shadow active:cursor-grabbing",
        selected ? "ring-2 ring-indigo-400 shadow-md" : "ring-1 ring-neutral-200 hover:shadow-md",
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
      <CardHeader icon={<IconLink className="h-3.5 w-3.5" />} label="Tautan" />

      {showForm ? (
        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) {
              void resolveLink(element.id, draft);
              setEditing(false);
            }
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={stop}
            placeholder="Tempel tautan…"
            className="w-full bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
          />
        </form>
      ) : state === "pending" ? (
        // Skeleton animasi supaya tidak terasa membeku saat menunggu pratinjau.
        <div className="p-3">
          <div className="h-28 -mx-3 -mt-3 mb-3 animate-pulse bg-neutral-100" />
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
          <p className="mt-2 truncate text-xs text-neutral-400">Mengambil pratinjau {host}…</p>
        </div>
      ) : (
        <>
          {image && (
            // gambar dari domain sembarangan; next/image butuh allowlist per host
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-28 w-full bg-neutral-100 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="p-3">
            <p className="line-clamp-2 text-sm font-medium text-neutral-800">{title ?? host}</p>
            {description && (
              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{description}</p>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={stop}
              className="mt-1.5 block truncate text-xs text-indigo-500 hover:underline"
            >
              {siteName ?? host}
            </a>

            {state === "failed" && (
              <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-2">
                <span className="text-xs text-amber-600">Pratinjau gagal</span>
                <button
                  onPointerDown={stop}
                  onClick={() => void resolveLink(element.id, url)}
                  className="rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  Coba lagi
                </button>
                <button
                  onPointerDown={stop}
                  onClick={() => {
                    setDraft(url);
                    setEditing(true);
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  Ubah URL
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const LinkCard = memo(LinkCardBase);
