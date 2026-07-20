"use client";

import { memo, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import { useElementDrag } from "@/lib/useElementDrag";
import type { LinkElement } from "@/lib/types";
import { ConnectHandle } from "./ConnectHandle";

function LinkCardBase({ element }: { element: LinkElement }) {
  const selected = useCanvasStore((s) => s.selectedIds.includes(element.id));
  const resolveLink = useCanvasStore((s) => s.resolveLink);
  const { rootRef, dragHandlers } = useElementDrag(element);

  const { url, title, description, image, siteName, state } = element.content;
  const [draft, setDraft] = useState(url);

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  return (
    <div
      ref={rootRef}
      data-element-id={element.id}
      className={[
        "group absolute cursor-grab overflow-hidden rounded-md bg-white shadow-sm transition-shadow active:cursor-grabbing",
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

      {state === "empty" ? (
        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void resolveLink(element.id, draft);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tempel tautan…"
            className="w-full bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
          />
        </form>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- gambar dari
              domain sembarangan; next/image butuh allowlist per host */}
          {image && (
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
            <p className="line-clamp-2 text-sm font-medium text-neutral-800">
              {state === "pending" ? "Mengambil pratinjau…" : (title ?? host)}
            </p>
            {description && (
              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{description}</p>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-1.5 block truncate text-xs text-blue-500 hover:underline"
            >
              {siteName ?? host}
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export const LinkCard = memo(LinkCardBase);
